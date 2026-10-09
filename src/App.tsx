import { Route, Routes } from "react-router-dom";

import { AppShell } from "./components/layout/AppShell";

import { AvailabilityPage } from "../src/components/pages/AvailabilityPage";
import { DataSourcesPage } from "../src/components/pages/DataSourcesPage";
import { NotFoundPage } from "../src/components/pages/NotFoundPage";
import { OverviewPage } from "../src/components/pages/OverviewPage";
import { ResourceDetailPage } from "../src/components/pages/ResourceDetailPage";
import { ResourcesPage } from "../src/components/pages/ResourcesPage";
import {
  ProjectsPage,
} from "./components/pages/ProjectsPage";

import {
  ProjectDetailPage,
} from "./components/pages/ProjectDetailPage";

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<OverviewPage />} />

        <Route path="/availability" element={<AvailabilityPage />} />

        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/projects" element={<ProjectsPage />}/>

        <Route path="/projects/:projectId" element={<ProjectDetailPage />}/>

        <Route path="/resources/:employeeId" element={<ResourceDetailPage />} />

        <Route path="/data-sources" element={<DataSourcesPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
