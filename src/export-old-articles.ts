import { gql, GraphQLClient, request } from "graphql-request";
import * as dotenv from "dotenv";
import { readFile, writeFile } from "fs/promises";
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
  heading: string;
  showHeading: boolean;
  componentType: string;
  heroImageRemoteURL: string;
  body: IRichText;
  aside: IRichText;
}

export async function grabOldArticleInfo() {
  // Credentials and endpoint for the old CMS project
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
      pages(where: { pageType: blog }, first: 1) {
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
  const allArticlePagesData = await oldDataClient.request<IOldArticleQuery>(
    allArticlePagesQuery
  );

  // Write a text file to this directory with the results of query
  await writeFile(
    "allArticlePagesQueryOutput.json",
    JSON.stringify(allArticlePagesData)
  );

  // Look at the newly created json file for the article data we need
  const json = await readFile("allArticlePagesQueryOutput.json", "utf8");
  const allArticleData = JSON.parse(json);

  const articleDataInNewFormat: Array<INewArticleVariables> = [];
  for (const page of allArticleData.pages) {
    const firstContentBlock = page.blocks.filter(
      (block: IExtractedBlockInfo) => block.__typename === "ContentBlock"
    )[0];

    const imageHeroBlock = page.blocks.filter(
      (block: IExtractedBlockInfo) => block.__typename === "ImageBlock"
    )[0];

    const singleArticleVariables = {
      heading: page.summary
        ? page.summary.text
        : "No summary found for this article's page.",
      showHeading: page.summary ? true : false,
      componentType: "BodyText",
      heroImageRemoteURL: imageHeroBlock
        ? imageHeroBlock.url
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
  }
  return articleDataInNewFormat;
}

grabOldArticleInfo()
  .then((value) =>
    console.log(
      `Array of ${
        value.length
      } variable sets created ✅\n\n\nEach one will be used to create an article...\n\n\nHere is the first one:\n\n${JSON.stringify(
        value[0]
      )}\n\n\n\n\n\n`
    )
  )
  .catch((error) => console.error("grabOldArticleInfo failed: ", error));

// Query to extract a single old content block
// const singleContentBlockQuery = gql`
//   query OldArticleQuery {
//     contentBlock(where: { id: "cks7d8rx4c2b30c01cizy0cjb" }) {
//       date
//       showDate
//       title
//       showTitle
//       heading
//       gradientColour
//       message {
//         raw
//       }
//       aside {
//         raw
//         references {
//           ... on Asset {
//             id
//           }
//           ... on Page {
//             id
//           }
//         }
//       }
//     }
//   }
// `;

// const singleBlockData = await oldDataClient.request<IOldArticleQuery>(
//   singleContentBlockQuery
// );

// await writeFile("queryOutput.json", JSON.stringify(singleBlockData));

// references {
//   ... on Asset {
//     fileName
//     handle
//     url
//   }
//   ... on Page {
//     id
//   }
// }
