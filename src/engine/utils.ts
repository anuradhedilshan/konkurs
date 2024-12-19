/* eslint-disable @typescript-eslint/no-explicit-any */
import { load } from "cheerio";

export const parseFooterArchive = (html: string): YearArchive[] => {
  const $ = load(html);
  const archives: YearArchive[] = [];

  // Iterate over each ".archive-year" div
  $(".archive-year").each((_: any, yearElement: any) => {
    const yearSection = $(yearElement);

    // Extract year name from the <strong> tag
    const yearName = yearSection
      .find("strong span")
      .first()
      .text()
      .trim()
      .replace(/:$/, "");

    // Gather all months in this year
    const months: Month[] = [];
    yearSection
      .find("a.archive-month-active")
      .each((_: any, monthElement: any) => {
        const month = $(monthElement);
        const name = month.text().trim(); // Month name
        const link = month.attr("href") || ""; // Month link (default empty if missing)

        months.push({ name, link });
      });

    // Append this year and its months to the archives list
    if (yearName) {
      archives.push({ name: yearName, months });
    }
  });

  return archives;
};



export const parseHomePageRight = (html: string): Result => {
  const $ = load(html);

  // Extract the title text from the <h1> with class "large"
  const title = $("h1.large").text().trim() || "";

  // Find the last <a> inside ".homepage-right-inside"
  const lastLinkElement = $(".homepage-right-inside a").last();
  let link = lastLinkElement.attr("href") || null;

  // Normalize the link to remove .html and keep the base URL
  if (link) {
    link = link.replace(/\/[^/]*\.html$/, "/");
  }

  // Extract max pages from the last link's text
  const maxpagesText = lastLinkElement.text().trim();
  const maxpagesMatch = maxpagesText.match(/(\d+)/); // Extract digits
  const maxpages = maxpagesMatch ? parseInt(maxpagesMatch[1], 10) : null;

  return { title, maxpages, link };
};

export const extractTop20Links = (html: string): string[] => {
  const $ = load(html);

  // Find all <a> tags inside <ul class="top20"> and extract their href attributes
  const links: string[] = [];

  $("ul.top20 a.newlisting-item").each((_, element) => {
    const href = $(element).attr("href");
    if (href) {
      links.push(href); // Add href to the result if it exists
    }
  });

  return links;
};

export const parseCampaign = (html: string): CampaignData => {
  const $ = load(html);

  // Extract Title
  const title = $("div.listing-title h1[itemprop='name']").text().trim();

  // Extract Period
  const startPeriodMatch = title.match(
    /(Ianuarie|Februarie|Martie|Aprilie|Mai|Iunie|Iulie|August|Septembrie|Octombrie|Noiembrie|Decembrie) \d{4}/i
  );
  const endPeriodMatch = title.match(
    /-\s*(Ianuarie|Februarie|Martie|Aprilie|Mai|Iunie|Iulie|August|Septembrie|Octombrie|Noiembrie|Decembrie) \d{4}/i
  );
  const startPeriod = startPeriodMatch ? startPeriodMatch[0] : "N/A";
  const endPeriod = endPeriodMatch ? endPeriodMatch[1] : startPeriod; // Fallback to start period if end not present

  // Extract Participant Incentive
  const incentive = $("h2.prize_list[itemprop='description']").text().trim();

  // Extract Campaign End Date
  const endDate = $("span.value.red")
    .text()
    .replace("Concursul s-a terminat pe", "")
    .trim();

  // Extract Source
  const source = $("li .value.strong a#primary_url").attr("href") || "N/A";

  // Extract Campaign Type
  const campaignType =
    $("li:contains('Tip concurs:') span.value.strong").text().trim() || "N/A";

  // Extract Prizes
  const prizes =
    $("h2.prize_list[itemprop='description']").text().trim() || "N/A";

  // Extract Campaign Mechanics
  const mechanics =
    $("div.listing-user-action p").first().text().trim() || "N/A";

  // Extract Terms and Conditions
  const termsAndConditions = $("a.rules-url").attr("href") || "N/A";

  return {
    title,
    startPeriod,
    endPeriod,
    incentive,
    endDate,
    source,
    campaignType,
    prizes,
    mechanics,
    termsAndConditions,
  };
};



export function sleep(ms:number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}