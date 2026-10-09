// Every variable the sites routes read (SitesSettings and AuthSettings), with placeholder ids.
export const SITES_ENV = {
  JUNKSNAP_STAGE: "dev",
  SITES_TABLE: "junksnap-dev-sites",
  VOTES_TABLE: "junksnap-dev-votes",
  CLEANUPS_TABLE: "junksnap-dev-cleanups",
  REPORTS_TABLE: "junksnap-dev-reports",
  DEVICES_TABLE: "junksnap-dev-devices",
  USERS_TABLE: "junksnap-dev-users",
  SCORES_TABLE: "junksnap-dev-scores",
  ORIGINALS_BUCKET: "junksnap-dev-originals-000000000000",
  PUBLIC_BASE_URL: "https://d111111abcdef8.cloudfront.net",
  REPORTS_QUEUE_URL: "https://sqs.ap-south-1.amazonaws.com/000000000000/junksnap-dev-reports",
  COGNITO_USER_POOL_ID: "ap-south-1_AbCdEf123",
  COGNITO_CLIENT_ID: "test-client-id",
};
