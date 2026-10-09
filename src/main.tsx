import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./index.css";

import { resourceMonthlyRecords, unassignedDemand } from "./data";

import { logDataValidation } from "./utils/validateData";

import { validateAvailabilityDomain } from "./utils/validateAvailabilityDomain";

import { validatePhase6 } from "./utils/validatePhase6";

import { validateAvailabilityV1 } from "./services/availabilityValidationService";

import {
  getResourceDiagnostics,
  logResourceDiagnostics,
} from "./utils/resourceDiagnostics";

import { logTimeAwareValidationSummary } from "./utils/runTimeAwareValidations";

/**
 * Resource Vision 2.0 application bootstrap.
 *
 * Existing domain validations and new
 * time-aware validations run in development.
 *
 * No validation is executed in production.
 */

if (import.meta.env.DEV) {
  /*
   * Existing source-data validation.
   */
  logDataValidation();

  /*
   * Existing availability domain validation.
   */
  validateAvailabilityDomain();

  /*
   * Existing resource diagnostics.
   */
  const diagnostics = getResourceDiagnostics(
    resourceMonthlyRecords,
    unassignedDemand,
  );

  /*
   * Existing phase validations.
   */
  validatePhase6();

  validateAvailabilityV1();

  /*
   * Consolidated time-aware validations.
   *
   * Includes:
   * - Expected release
   * - Partial and full release
   * - Project priority
   * - Availability by start
   * - Release integration
   * - Year-boundary scenarios
   */
  logTimeAwareValidationSummary();

  /*
   * Existing diagnostics output.
   */
  logResourceDiagnostics(diagnostics);
}

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("[Resource Vision] Application root element not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
