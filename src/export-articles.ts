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

async function transferOldArticlesToNewCMS() {
  const oldDataClient = new GraphQLClient(
    process.env.PROJECT_1_GRAPHCMS_ENDPOINT,
    {
      headers: {
        authorization: `Bearer ${process.env.PROJECT_1_GRAPHCMS_TOKEN}`,
      },
    }
  );

  // Query to extract old articles
  const query = gql`
    query OldArticlesQuery {
      contentBlock(where: { id: "cks7d8rx4c2b30c01cizy0cjb" }) {
        date
        title
        author
        showTitle
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
  const data = await oldDataClient.request<IOldArticleQuery>(query);

  // Write a text file to this directory with the results of query
  await writeFile("queryOutput.json", JSON.stringify(data));

  // Mutation to add articles to new CMS project
  const mutation = gql`
    mutation AddOldArticleToNewProject(
      $title: String!
      $slug: String!
      $mainBody: RichTextAST!
      $asideBody: RichTextAST!
    ) {
      createArticle(
        data: {
          title: $title
          date: "2023-02-03T01:00:00Z"
          description: "Article model doesn't have a summary field yet. We might put this in, but then where would it come from on the original content block?"
          slug: $slug
          indexed: true
          hidden: false
          featuredImage: {}
          content: {
            create: {
              Collection: {
                showHeading: false
                heading: "AsideAndBody Collection Heading"
                collectionType: AsideAndBody
                body: $asideBody
                contents: {
                  create: {
                    Component: {
                      heading: "heading for the main body component"
                      showHeading: false
                      componentType: BodyText
                      body: $mainBody
                    }
                  }
                }
              }
            }
          }
        }
      ) {
        id
      }
    }
  `;

  const newDataClient = new GraphQLClient(
    process.env.PROJECT_2_GRAPHCMS_ENDPOINT,
    {
      headers: {
        authorization: `Bearer ${process.env.PROJECT_2_GRAPHCMS_TOKEN}`,
      },
    }
  );

  // Look at the newly created text file for the article data
  const json = await readFile("queryOutput.json", "utf8");
  const articleData = JSON.parse(json);
  const mutationVariables = {
    title: articleData.contentBlock.title,
    slug: slugify(articleData.contentBlock.title),
    mainBody: articleData.contentBlock.message,
    asideBody: articleData.contentBlock.aside,
  };
  console.log("Variables", JSON.stringify(mutationVariables, null, 2));
  const result = await newDataClient.request(mutation, mutationVariables);
  console.log("Result", result);
}

transferOldArticlesToNewCMS()
  .then(() => console.log("Job complete!"))
  .catch((error) => console.error("Ooops:", error));
