import { gql, GraphQLClient, request } from "graphql-request";
import * as dotenv from "dotenv";
import { readFile, writeFile } from "fs/promises";
import pThrottle, { ThrottledFunction } from "p-throttle";
dotenv.config();

interface IRichText {
  raw: {
    children: Array<{
      type: string;
      children: Array<{
        text: string;
      }>;
    }>;
  };
}

interface IOldArticleQuery {
  id: string;
  author?: string;
  title: string;
  message?: IRichText;
  date?: string;
  heading?: string;
  aside?: IRichText;
}

interface IExtractedBlockInfo {
  __typename:
    | "PageLink"
    | "ContentBlock"
    | "ImageBlock"
    | "FormComponent"
    | "Collection";
  id: string;
  title: string;
  showTitle: boolean | null;
  message?: IRichText;
  aside?: IRichText;
}

export interface INewArticleVariables {
  title: string;
  heading: string;
  showHeading: boolean;
  slug: string;
  componentType: string;
  heroImageRemoteURL: string;
  body: IRichText;
  aside: IRichText;
}

// const rawRequester = oldDC.request;
// const requester = throttler(rawRequester);

export async function grabOldArticleInfo() {
  const oldDataClient = new GraphQLClient(
    process.env.PROJECT_1_GRAPHCMS_ENDPOINT,
    {
      headers: {
        authorization: `Bearer ${process.env.PROJECT_1_GRAPHCMS_TOKEN}`,
      },
    }
  );
  const allArticlePagesQuery = gql`
    query AllArticlePages {
      pages(where: { pageType: blog }) {
        author
        date
        title
        pageCategory
        summary {
          text
        }
        heroImage {
          fileName
          handle
          url
        }
        blocks {
          __typename
          ... on ImageBlock {
            id
            image {
              fileName
              handle
              url
            }
          }
          ... on ContentBlock {
            id
            title
            showTitle
            aside {
              raw
            }
            message {
              raw
            }
          }
        }
      }
    }
  `;

  // Execute the query using the endpoint and token
  const allArticlePagesData = (await oldDataClient.request(
    allArticlePagesQuery
  )) as IOldArticleQuery;

  // Write a text file to this directory with the results of query
  await writeFile(
    "allArticlePagesQueryOutput.json",
    JSON.stringify(allArticlePagesData)
  );

  // Look at the newly created json file for the article data we need
  const json = await readFile("allArticlePagesQueryOutput.json", "utf8");
  const allArticleData = JSON.parse(json);

  const articleDataInNewFormat: Array<INewArticleVariables> = [];

  let counter = 1;
  for (const page of allArticleData.pages) {
    const firstContentBlock = page.blocks.filter(
      (block: IExtractedBlockInfo) => block.__typename === "ContentBlock"
    )[0];

    const imageHeroBlock = page.blocks.filter(
      (block: IExtractedBlockInfo) => block.__typename === "ImageBlock"
    )[0];
    console.log(
      `\nSearched "${page.title}" for image hero, found:\n`,
      imageHeroBlock ? imageHeroBlock : `Nothing`
    );
    const singleArticleVariables: INewArticleVariables = {
      title: `Article: ${counter}`,
      slug: `article/${counter}`,
      heading: page.summary
        ? page.summary.text
        : "No summary found for this article's page.",
      showHeading: page.summary ? true : false,
      componentType: "BodyText",
      heroImageRemoteURL: imageHeroBlock
        ? imageHeroBlock.image.url
        : "https://media.graphassets.com/vsEgQ4hXSCyQuKlpEin8",
      body:
        firstContentBlock && firstContentBlock.message
          ? firstContentBlock.message.raw
          : {
              children: [
                {
                  type: "paragraph",
                  children: [
                    {
                      text: "No body found for this article (looked inside the message field of the first content block of the page, with type BodyText).",
                    },
                  ],
                },
              ],
            },
      aside:
        firstContentBlock && firstContentBlock.aside
          ? firstContentBlock.aside.raw
          : {
              children: [
                {
                  type: "paragraph",
                  children: [
                    {
                      text: "No aside field for for this article (looked inside the aside field of the first content block of the page, with type BodyText)",
                    },
                  ],
                },
              ],
            },
    };
    articleDataInNewFormat.push(singleArticleVariables);
    counter++;
  }
  return articleDataInNewFormat;
}

grabOldArticleInfo()
  .then((value) =>
    console.log(
      `\n\n\nArray of ${value.length} variable sets created ✅\n\n\nEach one will be used to create an article...`
    )
  )
  .catch((error) => console.error("grabOldArticleInfo failed: ", error));
