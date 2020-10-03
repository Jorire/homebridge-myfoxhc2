export interface Site {
  /**
   * The site unique identifier
   */
  siteId: string;
  /**
   * The site label
   */
  label: string;
  /**
   * The brand of the site
   */
  brand: string;
  /**
   * The timezone of the site location
   */
  timezone: string;
  /**
   * AXA Assistance identifier
   */
  AXA: string;
  /**
   * Number of cameras on the site
   */
  cameraCount: number;
  /**
   * Number of gates on the site
   */
  gateCount: number;
  /**
   * Number of shutters on the site
   */
  shutterCount: number;
  /**
   * Number of sockets on the site
   */
  socketCount: number;
  /**
   * Number of modules on the site
   */
  moduleCount: number;
  /**
   * Number of heaters on the site
   */
  heaterCount: number;
  /**
   * Number of scenarios on the site
   */
  scenarioCount: number;
  /**
   * Number of temperature sensors on the site
   */
  deviceTemperatureCount: number;
  /**
   * Number of IntelliTag on the site
   */
  deviceStateCount: number;
  /**
   * Number of light sensors on the site
   */
  deviceLightCount: number;
  /**
   * Number of generic detectors on the site
   */
  deviceDetectorCount: number;
}