import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/layout/AppShell";
import { AvailabilityPage } from "./features/availability/AvailabilityPage";
import { EmployeePage } from "./features/employee/EmployeePage";
import { ProjectsPage } from "./features/projects/ProjectsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<AvailabilityPage />} />
        <Route path="/employee" element={<EmployeePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
