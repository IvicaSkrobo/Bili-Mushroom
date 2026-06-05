export const WEBSITE_URL = 'https://ivicaskrobo.github.io/Bili-Mushroom/';
export const BUG_REPORT_URL =
  'https://github.com/IvicaSkrobo/Bili-Mushroom/issues/new?template=bug_report.yml&labels=bug';
const configuredDonateUrl = import.meta.env.VITE_DONATE_URL?.trim() || 'https://ko-fi.com/skroboivica';

export const HAS_DONATE_URL = /^https:\/\//i.test(configuredDonateUrl);
export const DONATE_URL = configuredDonateUrl;
