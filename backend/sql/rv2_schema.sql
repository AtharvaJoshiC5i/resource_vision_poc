/* ============================================================================
   Resource Vision - precomputed tables (approach B)

   The API reads ONLY these small tables. All heavy work happens once per
   refresh inside dbo.rv2_Refresh, never on a user request.

   Run through backend/scripts/refresh_facts.py (splits on GO lines), or paste
   into SSMS / Azure Data Studio. Safe to re-run.

   Rules implemented here are documented in docs/CALCULATION_SPEC.md and are
   verified against the Python engine by backend/scripts/check_facts.py.
   ============================================================================ */

IF OBJECT_ID(N'dbo.rv2_Meta') IS NULL
CREATE TABLE dbo.rv2_Meta (
    MetaId         int       NOT NULL PRIMARY KEY,
    Version        bigint    NOT NULL,
    RefreshedUtc   datetime2 NOT NULL,
    TodayDate      date      NOT NULL,
    CapacityHours  float     NOT NULL,
    WindowStartKey int       NOT NULL,
    WindowEndKey   int       NOT NULL
);
GO

IF OBJECT_ID(N'dbo.rv2_MonthInfo') IS NULL
CREATE TABLE dbo.rv2_MonthInfo (
    MonthKey   int  NOT NULL PRIMARY KEY,
    MonthStart date NOT NULL,
    MonthEnd   date NOT NULL,
    HasData    bit  NOT NULL
);
GO

IF OBJECT_ID(N'dbo.rv2_Quality') IS NULL
CREATE TABLE dbo.rv2_Quality (
    Name  nvarchar(100) NOT NULL PRIMARY KEY,
    Value int           NOT NULL
);
GO

IF OBJECT_ID(N'dbo.rv2_Employee') IS NULL
CREATE TABLE dbo.rv2_Employee (
    EmployeeKey          nvarchar(200) NOT NULL PRIMARY KEY,
    EmployeeCode         nvarchar(200) NOT NULL,
    Name                 nvarchar(500) NOT NULL,
    NameSource           nvarchar(30)  NOT NULL,
    HrMatched            bit           NOT NULL,
    DatesValid           bit           NOT NULL,
    JoiningDate          date          NULL,
    ExitDate             date          NULL,
    EmployeeStatus       nvarchar(100) NULL,
    PrimaryCapability    nvarchar(255) NULL,
    SecondaryCapability  nvarchar(255) NULL,
    Grade                nvarchar(100) NULL,
    Country              nvarchar(100) NULL,
    Location             nvarchar(255) NULL,
    Division             nvarchar(255) NULL,
    Department           nvarchar(255) NULL,
    Email                nvarchar(255) NULL,
    ManagerName          nvarchar(255) NULL,
    ManagerCode          nvarchar(100) NULL,
    EmploymentType       nvarchar(100) NULL
);
GO

IF OBJECT_ID(N'dbo.rv2_Project') IS NULL
CREATE TABLE dbo.rv2_Project (
    ProjectId        nvarchar(100)  NOT NULL PRIMARY KEY,
    ProjectName      nvarchar(500)  NULL,
    ClientBU         nvarchar(1000) NULL,
    ProjectStatus    nvarchar(100)  NULL,
    ProjectLead      nvarchar(255)  NULL,
    ContractType     nvarchar(255)  NULL,
    ContractCategory nvarchar(50)   NULL,
    StartDate        date           NULL,
    EndDate          date           NULL,
    Description      nvarchar(max)  NULL
);
GO

IF OBJECT_ID(N'dbo.rv2_Allocation') IS NULL
BEGIN
    CREATE TABLE dbo.rv2_Allocation (
        AllocId        bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SourceRowId    nvarchar(150) NULL,
        EmployeeKey    nvarchar(200) NOT NULL,
        MonthKey       int           NOT NULL,
        ProjectId      nvarchar(100) NULL,
        ProposalNumber bigint        NULL,
        SubProject     nvarchar(450) NULL,
        Effort         float         NULL,
        RowStatus      varchar(12)   NOT NULL,   -- valid | placeholder | unresolved
        Reason         nvarchar(200) NULL,
        ContractType   nvarchar(255) NULL,
        StartDate      date          NULL,
        EndDate        date          NULL
    );
    CREATE INDEX IX_rv2_Allocation_Employee ON dbo.rv2_Allocation (EmployeeKey, MonthKey);
    CREATE INDEX IX_rv2_Allocation_Project  ON dbo.rv2_Allocation (ProjectId, MonthKey);
END
GO

IF OBJECT_ID(N'dbo.rv2_EmployeeMonth') IS NULL
BEGIN
    CREATE TABLE dbo.rv2_EmployeeMonth (
        EmployeeKey      nvarchar(200) NOT NULL,
        MonthKey         int           NOT NULL,
        Capacity         float         NULL,
        NamedRows        int           NOT NULL,
        ValidRows        int           NOT NULL,
        PlaceholderRows  int           NOT NULL,
        UnresolvedRows   int           NOT NULL,
        ProjectCount     int           NOT NULL,
        RawHours         float         NOT NULL,
        VerifiedHours    float         NULL,
        UnresolvedHours  float         NULL,
        Planned          float         NULL,
        Remaining        float         NULL,
        Status           nvarchar(30)  NOT NULL,
        StatusReason     nvarchar(200) NOT NULL,
        ContractCategory nvarchar(30)  NOT NULL,
        CONSTRAINT PK_rv2_EmployeeMonth PRIMARY KEY (EmployeeKey, MonthKey)
    );
    CREATE INDEX IX_rv2_EmployeeMonth_Month ON dbo.rv2_EmployeeMonth (MonthKey)
        INCLUDE (Status, ContractCategory);
END
GO

CREATE OR ALTER PROCEDURE dbo.rv2_Refresh
    @Today         date,
    @CapacityHours float = 176
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @WinStart date = DATEFROMPARTS(YEAR(@Today), MONTH(@Today), 1);
    DECLARE @WinEnd   date = EOMONTH(DATEADD(month, 18, @WinStart));      -- current month + 18

    /* ---- 1. reporting window (19 months) --------------------------------- */
    ;WITH N AS (
        SELECT TOP (19) i = ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 FROM sys.all_objects
    )
    SELECT MonthStart = DATEADD(month, i, @WinStart),
           MonthEnd   = EOMONTH(DATEADD(month, i, @WinStart)),
           MonthKey   = YEAR(DATEADD(month, i, @WinStart)) * 100 + MONTH(DATEADD(month, i, @WinStart))
    INTO #Months
    FROM N;

    SELECT m.MonthKey, m.MonthStart, m.MonthEnd,
           HasData = CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.project_track_proposals_table p
                                            WHERE p.month_key >= m.MonthStart AND p.month_key <= m.MonthEnd)
                               THEN 1 ELSE 0 END AS bit)
    INTO #MonthData
    FROM #Months m;

    /* ---- 2. named Project Track rows inside the window -------------------- */
    SELECT SourceRowId    = dbo.rv_Blank(p.row_id),
           ProjectId      = dbo.rv_Blank(p.project_id),
           ProposalNumber = p.proposal_number,
           SubProjectRaw  = p.sub_project_name,
           EmployeeKey    = dbo.rv_Key(p.employee_id),
           EmployeeCode   = dbo.rv_Clean(p.employee_id),
           MonthKey       = YEAR(p.month_key) * 100 + MONTH(p.month_key),
           FirstDay       = CASE WHEN DAY(p.month_key) = 1 THEN 1 ELSE 0 END,
           Effort         = CAST(p.effort_value AS float),
           IsOverride     = p.is_override,
           ContractType   = dbo.rv_Clean(p.contract_type),
           StartDate      = p.start_date,
           EndDate        = p.end_date
    INTO #PT
    FROM dbo.project_track_proposals_table p
    WHERE p.month_key >= @WinStart AND p.month_key <= @WinEnd
      AND dbo.rv_Key(p.employee_id) IS NOT NULL;

    /* Duplicate group = same employee, month, project, proposal, sub-project (case-sensitive).
       Two or more positive-hour rows in one group are a conflict. included_default is NOT used. */
    SELECT t.*,
           PosInGroup = SUM(CASE WHEN t.Effort > 0 THEN 1 ELSE 0 END) OVER (
               PARTITION BY t.EmployeeKey, t.MonthKey,
                            CAST(t.ProjectId AS nvarchar(450)) COLLATE Latin1_General_100_BIN2,
                            t.ProposalNumber,
                            CAST(t.SubProjectRaw AS nvarchar(450)) COLLATE Latin1_General_100_BIN2)
    INTO #PT2
    FROM #PT t;

    SELECT a.SourceRowId, a.EmployeeKey, a.EmployeeCode, a.MonthKey, a.ProjectId, a.ProposalNumber,
           a.SubProjectRaw, a.Effort, a.ContractType, a.StartDate, a.EndDate,
           RowStatus = CASE
               WHEN a.FirstDay = 0                              THEN 'unresolved'
               WHEN a.Effort IS NULL                            THEN 'unresolved'
               WHEN a.Effort < 0                                THEN 'unresolved'
               WHEN a.IsOverride IS NULL OR a.IsOverride = 1    THEN 'unresolved'
               WHEN a.PosInGroup >= 2                           THEN 'unresolved'
               WHEN a.Effort = 0                                THEN 'placeholder'
               ELSE 'valid' END,
           Reason = CASE
               WHEN a.FirstDay = 0                              THEN N'month_key is not the first day of a month'
               WHEN a.Effort IS NULL                            THEN N'effort missing'
               WHEN a.Effort < 0                                THEN N'negative effort'
               WHEN a.IsOverride IS NULL OR a.IsOverride = 1    THEN N'override flag missing or manual override'
               WHEN a.PosInGroup >= 2                           THEN N'duplicate records with conflicting hours'
               ELSE NULL END,
           ContractClass = CASE
               WHEN c.t = N't&m-fte' THEN 'FTE'
               WHEN c.t IN (N't&m-hrs', N'output-effortbased', N'output-fixedspread') THEN 'Program'
               ELSE 'Unclassified' END
    INTO #Alloc
    FROM #PT2 a
    CROSS APPLY (SELECT t = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(a.ContractType, N''),
                     NCHAR(8211), N'-'), NCHAR(8212), N'-'), N' ', N''), NCHAR(160), N''))) c;

    /* ---- 3. employees that appear in the window ---------------------------- */
    SELECT EmployeeKey, EmployeeCode
    INTO #Keys
    FROM (SELECT EmployeeKey, EmployeeCode,
                 rn = ROW_NUMBER() OVER (PARTITION BY EmployeeKey
                                         ORDER BY CASE WHEN SourceRowId IS NULL THEN 1 ELSE 0 END, SourceRowId)
          FROM #Alloc WHERE EmployeeCode IS NOT NULL) x
    WHERE rn = 1;

    SELECT k            = dbo.rv_Key(h.EmployeeCode),
           Code         = dbo.rv_Clean(h.EmployeeCode),
           Name         = dbo.rv_Clean(h.EmployeeName),
           Joining      = CAST(h.DateOfJoining AS date),
           ExitEff      = COALESCE(CAST(h.ExitDate AS date), CAST(h.DateOfLeaving AS date),
                                   CASE WHEN UPPER(COALESCE(dbo.rv_Clean(h.EmployeeStatus), N'')) LIKE N'FNF%'
                                        THEN CAST(h.DateofResignation AS date) END),
           EStatus      = dbo.rv_Clean(h.EmployeeStatus),
           PrimaryCap   = dbo.rv_Clean(h.[Primary Practice]),
           SecondaryCap = dbo.rv_Clean(h.[Secondary Practice]),
           Grade        = dbo.rv_Clean(h.[Grade Code]),
           Country      = dbo.rv_Clean(h.COUNTRY),
           Location     = dbo.rv_Clean(h.Location),
           Division     = dbo.rv_Clean(h.Division),
           Department   = dbo.rv_Clean(h.Department),
           Email        = dbo.rv_Clean(h.Email),
           ManagerName  = dbo.rv_Clean(h.ReportingManagerName),
           ManagerCode  = dbo.rv_Clean(h.ReportingManagerCode),
           EmpType      = dbo.rv_Clean(h.EmploymentType)
    INTO #Hr0
    FROM dbo.zinghr_employee_master h
    WHERE dbo.rv_Key(h.EmployeeCode) IS NOT NULL;

    SELECT x.*, Cnt = COUNT(*) OVER (PARTITION BY x.k) INTO #Hr FROM #Hr0 x;

    /* Employee dimension (like Power BI): every valid HR employee, plus every Project Track employee id
       (any month) that has no valid HR record - not only employees with rows in the window. */
    INSERT #Keys (EmployeeKey, EmployeeCode)
    SELECT h.k, h.Code FROM #Hr h
    WHERE h.Cnt = 1 AND NOT EXISTS (SELECT 1 FROM #Keys k WHERE k.EmployeeKey = h.k);

    INSERT #Keys (EmployeeKey, EmployeeCode)
    SELECT x.k, x.code
    FROM (SELECT k = dbo.rv_Key(p.employee_id), code = MIN(dbo.rv_Clean(p.employee_id))
          FROM dbo.project_track_proposals_table p
          WHERE dbo.rv_Key(p.employee_id) IS NOT NULL
          GROUP BY dbo.rv_Key(p.employee_id)) x
    WHERE NOT EXISTS (SELECT 1 FROM #Keys k WHERE k.EmployeeKey = x.k);

    /* Project Track "real name" attributes: latest month wins, blanks never overwrite. */
    SELECT k    = dbo.rv_Key(p.employee_id),
           n    = dbo.rv_Clean(p.employee_name),
           pc   = dbo.rv_Clean(p.primary_capability),
           sc   = dbo.rv_Clean(p.secondary_capability),
           dp   = dbo.rv_Clean(p.department),
           gr   = dbo.rv_Clean(p.grade),
           lc   = dbo.rv_Clean(p.location),
           co   = dbo.rv_Clean(p.country),
           MK   = p.month_key,
           rid  = dbo.rv_Blank(p.row_id)
    INTO #L0
    FROM dbo.project_track_proposals_table p
    WHERE p.employee_name IS NOT NULL;

    ;WITH R AS (
        SELECT l.*,
               rk = ROW_NUMBER() OVER (PARTITION BY l.k
                                       ORDER BY CASE WHEN l.MK IS NULL THEN 1 ELSE 0 END, l.MK DESC,
                                                CASE WHEN l.rid IS NULL THEN 1 ELSE 0 END, l.rid)
        FROM #L0 l
        JOIN #Keys kk ON kk.EmployeeKey = l.k
        WHERE l.n IS NOT NULL AND UPPER(l.n) <> l.k
    ), P2 AS (
        SELECT k, pfx = RIGHT('0000000000' + CAST(rk AS varchar(10)), 10), n, pc, sc, dp, gr, lc, co FROM R
    )
    SELECT k,
           Name       = SUBSTRING(MIN(CASE WHEN n  IS NOT NULL THEN CAST(pfx + n  AS nvarchar(2000)) END), 11, 2000),
           PrimaryCap = SUBSTRING(MIN(CASE WHEN pc IS NOT NULL THEN CAST(pfx + pc AS nvarchar(2000)) END), 11, 2000),
           SecondaryCap = SUBSTRING(MIN(CASE WHEN sc IS NOT NULL THEN CAST(pfx + sc AS nvarchar(2000)) END), 11, 2000),
           Department = SUBSTRING(MIN(CASE WHEN dp IS NOT NULL THEN CAST(pfx + dp AS nvarchar(2000)) END), 11, 2000),
           Grade      = SUBSTRING(MIN(CASE WHEN gr IS NOT NULL THEN CAST(pfx + gr AS nvarchar(2000)) END), 11, 2000),
           Location   = SUBSTRING(MIN(CASE WHEN lc IS NOT NULL THEN CAST(pfx + lc AS nvarchar(2000)) END), 11, 2000),
           Country    = SUBSTRING(MIN(CASE WHEN co IS NOT NULL THEN CAST(pfx + co AS nvarchar(2000)) END), 11, 2000)
    INTO #Lookup
    FROM P2
    GROUP BY k;

    SELECT EmployeeKey          = kk.EmployeeKey,
           EmployeeCode         = COALESCE(h.Code, kk.EmployeeCode),
           Name                 = COALESCE(l.Name, h.Name, CASE WHEN h.k IS NULL THEN N'(Missing HR match)' ELSE N'-' END),
           NameSource           = CASE WHEN l.Name IS NOT NULL THEN N'Project Track'
                                       WHEN h.Name IS NOT NULL THEN N'ZingHR' ELSE N'Unavailable' END,
           HrMatched            = CAST(CASE WHEN h.k IS NULL THEN 0 ELSE 1 END AS bit),
           DatesValid           = CAST(CASE WHEN h.k IS NOT NULL AND h.Joining IS NOT NULL
                                             AND (h.ExitEff IS NULL OR h.ExitEff >= h.Joining) THEN 1 ELSE 0 END AS bit),
           JoiningDate          = h.Joining,
           ExitDate             = h.ExitEff,
           EmployeeStatus       = h.EStatus,
           PrimaryCapability    = COALESCE(l.PrimaryCap, h.PrimaryCap),
           SecondaryCapability  = COALESCE(l.SecondaryCap, h.SecondaryCap),
           Grade                = COALESCE(l.Grade, h.Grade),
           Country              = COALESCE(l.Country, h.Country),
           Location             = COALESCE(l.Location, h.Location),
           Division             = h.Division,
           Department           = COALESCE(l.Department, h.Department),
           Email                = h.Email,
           ManagerName          = h.ManagerName,
           ManagerCode          = h.ManagerCode,
           EmploymentType       = h.EmpType
    INTO #Emp
    FROM #Keys kk
    LEFT JOIN #Hr h     ON h.k = kk.EmployeeKey AND h.Cnt = 1
    LEFT JOIN #Lookup l ON l.k = kk.EmployeeKey;

    /* ---- 4. employee-month facts -------------------------------------------- */
    SELECT a.EmployeeKey, a.MonthKey,
           NamedRows       = COUNT(*),
           ValidRows       = SUM(CASE WHEN a.RowStatus = 'valid'       THEN 1 ELSE 0 END),
           PlaceholderRows = SUM(CASE WHEN a.RowStatus = 'placeholder' THEN 1 ELSE 0 END),
           UnresolvedRows  = SUM(CASE WHEN a.RowStatus = 'unresolved'  THEN 1 ELSE 0 END),
           ProjectCount    = COUNT(DISTINCT a.ProjectId),
           RawHours        = COALESCE(SUM(a.Effort), 0),
           VerifiedHours   = SUM(CASE WHEN a.RowStatus = 'valid'      THEN a.Effort END),
           UnresolvedHours = SUM(CASE WHEN a.RowStatus = 'unresolved' THEN a.Effort END),
           HasFte          = MAX(CASE WHEN a.ContractClass = 'FTE'     THEN 1 ELSE 0 END),
           HasProgram      = MAX(CASE WHEN a.ContractClass = 'Program' THEN 1 ELSE 0 END)
    INTO #EM
    FROM #Alloc a
    GROUP BY a.EmployeeKey, a.MonthKey;

    /* Out of scope: a matched employee with valid dates who is not employed that month. */
    SELECT x.*, e.HrMatched, e.DatesValid,
           Capacity = CASE WHEN e.HrMatched = 1 AND e.DatesValid = 1 THEN @CapacityHours END,
           Planned  = CASE WHEN x.UnresolvedRows = 0 AND x.ValidRows > 0 AND e.HrMatched = 1
                           THEN x.VerifiedHours END
    INTO #EM2
    FROM #EM x
    JOIN #Emp e    ON e.EmployeeKey = x.EmployeeKey
    JOIN #Months m ON m.MonthKey = x.MonthKey
    WHERE e.HrMatched = 0 OR e.DatesValid = 0
       OR (e.JoiningDate <= m.MonthEnd AND (e.ExitDate IS NULL OR e.ExitDate >= m.MonthStart));

    SELECT y.*,
           Remaining = CASE WHEN y.Capacity IS NOT NULL AND y.Planned IS NOT NULL THEN y.Capacity - y.Planned END
    INTO #EM3
    FROM #EM2 y;

    /* ---- 5. swap the published tables in one short transaction ---------------- */
    DECLARE @Version bigint = COALESCE((SELECT Version FROM dbo.rv2_Meta WHERE MetaId = 1), 0) + 1;

    BEGIN TRANSACTION;

    DELETE FROM dbo.rv2_EmployeeMonth;
    DELETE FROM dbo.rv2_Allocation;
    DELETE FROM dbo.rv2_Employee;
    DELETE FROM dbo.rv2_Project;
    DELETE FROM dbo.rv2_MonthInfo;
    DELETE FROM dbo.rv2_Quality;
    DELETE FROM dbo.rv2_Meta;

    INSERT dbo.rv2_MonthInfo (MonthKey, MonthStart, MonthEnd, HasData)
    SELECT MonthKey, MonthStart, MonthEnd, HasData FROM #MonthData;

    INSERT dbo.rv2_Employee (EmployeeKey, EmployeeCode, Name, NameSource, HrMatched, DatesValid, JoiningDate,
        ExitDate, EmployeeStatus, PrimaryCapability, SecondaryCapability, Grade, Country, Location, Division,
        Department, Email, ManagerName, ManagerCode, EmploymentType)
    SELECT EmployeeKey, EmployeeCode, Name, NameSource, HrMatched, DatesValid, JoiningDate,
        ExitDate, EmployeeStatus, PrimaryCapability, SecondaryCapability, Grade, Country, Location, Division,
        Department, Email, ManagerName, ManagerCode, EmploymentType
    FROM #Emp;

    INSERT dbo.rv2_Allocation (SourceRowId, EmployeeKey, MonthKey, ProjectId, ProposalNumber, SubProject,
        Effort, RowStatus, Reason, ContractType, StartDate, EndDate)
    SELECT a.SourceRowId, a.EmployeeKey, a.MonthKey, a.ProjectId, a.ProposalNumber,
           CAST(CASE WHEN a.SubProjectRaw IS NULL OR dbo.rv_Trim(a.SubProjectRaw) = N''
                          OR LOWER(dbo.rv_Trim(a.SubProjectRaw)) = N'null'
                     THEN N'(No sub-project)' ELSE dbo.rv_Trim(a.SubProjectRaw) END AS nvarchar(450)),
           a.Effort, a.RowStatus, a.Reason, a.ContractType, a.StartDate, a.EndDate
    FROM #Alloc a;

    INSERT dbo.rv2_EmployeeMonth (EmployeeKey, MonthKey, Capacity, NamedRows, ValidRows, PlaceholderRows,
        UnresolvedRows, ProjectCount, RawHours, VerifiedHours, UnresolvedHours, Planned, Remaining,
        Status, StatusReason, ContractCategory)
    SELECT z.EmployeeKey, z.MonthKey, z.Capacity, z.NamedRows, z.ValidRows, z.PlaceholderRows,
           z.UnresolvedRows, z.ProjectCount, z.RawHours, z.VerifiedHours, z.UnresolvedHours, z.Planned, z.Remaining,
           Status = CASE
               WHEN z.Capacity IS NULL OR z.Planned IS NULL THEN N'Unverified'
               WHEN ROUND(z.Remaining, 6) < 0  THEN N'Over-allocated'
               WHEN ROUND(z.Remaining, 6) = 0  THEN N'Fully Committed'
               WHEN ROUND(z.Planned, 6) = 0    THEN N'Fully Available'
               ELSE N'Partially Available' END,
           StatusReason = CASE
               WHEN z.Capacity IS NULL OR z.Planned IS NULL THEN
                    CASE WHEN z.HrMatched = 0 THEN N'Missing HR match: capacity not established'
                         WHEN z.Capacity IS NULL THEN N'Employment dates invalid: capacity not established'
                         WHEN z.UnresolvedRows > 0 THEN CAST(z.UnresolvedRows AS nvarchar(20)) + N' record(s) need review'
                         ELSE N'Only zero-effort records: effort marked 0, not verified' END
               ELSE N'Capacity and allocation resolved' END,
           ContractCategory = CASE WHEN z.HasFte = 1 THEN N'FTE-Based'
                                   WHEN z.HasProgram = 1 THEN N'Program-Based'
                                   ELSE N'Contract Not Specified' END
    FROM #EM3 z;

    /* Project dimension: reuse the catalog view (reads the source table directly). */
    INSERT dbo.rv2_Project (ProjectId, ProjectName, ClientBU, ProjectStatus, ProjectLead, ContractType,
        ContractCategory, StartDate, EndDate, Description)
    SELECT ProjectID, ProjectName, ClientBU, ProjectStatus, ProjectLead, ContractType,
           ContractCategory, StartDate, EndDate, Description
    FROM dbo.vwl_DimProject;

    INSERT dbo.rv2_Quality (Name, Value)
    SELECT N'unresolved_rows',  COUNT(*) FROM #Alloc WHERE RowStatus = 'unresolved'
    UNION ALL SELECT N'placeholder_rows', COUNT(*) FROM #Alloc WHERE RowStatus = 'placeholder'
    UNION ALL SELECT N'missing_hr_match_employees', COUNT(*) FROM #Emp WHERE HrMatched = 0
    UNION ALL SELECT N'rows_outside_employment', COUNT(*) FROM #Alloc a
              WHERE NOT EXISTS (SELECT 1 FROM dbo.rv2_EmployeeMonth em
                                WHERE em.EmployeeKey = a.EmployeeKey AND em.MonthKey = a.MonthKey);

    INSERT dbo.rv2_Meta (MetaId, Version, RefreshedUtc, TodayDate, CapacityHours, WindowStartKey, WindowEndKey)
    SELECT 1, @Version, SYSUTCDATETIME(), @Today, @CapacityHours,
           MIN(MonthKey), MAX(MonthKey) FROM #Months;

    COMMIT TRANSACTION;
END
GO
