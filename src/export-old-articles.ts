import { gql, GraphQLClient, request } from "graphql-request";
import * as dotenv from "dotenv";
import { readFile, writeFile } from "fs/promises";
import slugify from "@sindresorhus/slugify";
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
          raw
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
              references {
                ... on Asset {
                  fileName
                  handle
                  url
                }
                ... on Page {
                  id
                }
              }
            }
            message {
              raw
              references {
                ... on Asset {
                  id
                  fileName
                  url
                }
                ... on Page {
                  id
                }
              }
            }
          }
        }
      }
    }
  `;

  // Query to extract a single old content block
  const singleContentBlockQuery = gql`
    query OldArticleQuery {
      contentBlock(where: { id: "cks7d8rx4c2b30c01cizy0cjb" }) {
        date
        showDate
        title
        showTitle
        heading
        gradientColour
        message {
          raw
        }
        aside {
          raw
          references {
            ... on Asset {
              id
            }
            ... on Page {
              id
            }
          }
        }
      }
    }
  `;

  // Execute the query using the endpoint and token
  const singleBlockData = await oldDataClient.request<IOldArticleQuery>(
    singleContentBlockQuery
  );
  const allArticlePagesData = await oldDataClient.request<IOldArticleQuery>(
    allArticlePagesQuery
  );

  // Write a text file to this directory with the results of query
  await writeFile("queryOutput.json", JSON.stringify(singleBlockData));
  await writeFile(
    "allArticlePagesQueryOutput.json",
    JSON.stringify(allArticlePagesData)
  );

  // Look at the newly created json file for the article data we need
  const json = await readFile("allArticlePagesQueryOutput.json", "utf8");
  const allArticleData = JSON.parse(json);

  const articleDataInNewFormat = [];
  for (const page of allArticleData.pages) {
    const firstContentBlock = page.blocks.filter(
      (block) => block.__typename === "ContentBlock"
    )[0];
    console.log(firstContentBlock);
    const bodyTextComponentVariables = {
      heading: page.summary ? page.summary.raw : null,
      showHeading: true,
      componentType: "BodyText",
      body: firstContentBlock ? firstContentBlock.message.raw : null,
    };
    articleDataInNewFormat.push(
      JSON.stringify(bodyTextComponentVariables, null, 2)
    );
  }
  return articleDataInNewFormat;
  // const mutationVariables = {
  //   title: allArticleData.contentBlock.title,
  //   slug:
  //     slugify(allArticleData.contentBlock.title) ||
  //     `slug-${Math.floor(Math.random() * 10000) + 1}`,
  //   mainBody: allArticleData.contentBlock.message,
  //   asideBody: allArticleData.contentBlock.aside,
  // };

  // const json = await readFile("queryOutput.json", "utf8");
  // const articleData = JSON.parse(json);
  // const mutationVariables = {
  //   title: articleData.contentBlock.title,
  //   slug:
  //     slugify(articleData.contentBlock.title) ||
  //     `slug-${Math.floor(Math.random() * 10000) + 1}`,
  //   mainBody: articleData.contentBlock.message,
  //   asideBody: articleData.contentBlock.aside,
  // };

  // const mutationVariablesString = JSON.stringify(mutationVariables, null, 2);
  // return mutationVariablesString;
}

grabOldArticleInfo()
  .then((value) => console.log(`These are the variables:\n${value}`))
  .catch((error) => console.error("Oops:", error));
