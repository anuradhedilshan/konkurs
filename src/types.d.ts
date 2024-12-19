type Month = {
  name: string;
  link: string;
};
type YearArchive = {
  name: string;
  months: Month[];
};

type Result = {
  title: string;
  maxpages: number | null; // Null if not found
  link: string | null; // Null if not found
};

type CampaignData = {
  title: string;
  startPeriod: string;
  endPeriod: string;
  incentive: string;
  endDate: string;
  source: string;
  campaignType: string;
  prizes: string;
  mechanics: string;
  termsAndConditions: string;
};

type Type = "all" | "archived";
