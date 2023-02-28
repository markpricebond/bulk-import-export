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
    query OldArticleQuery {
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
  const bodyTextMutation = gql`
    mutation CreateBodyTextComponent($body: RichTextAST!, $heading: String!) {
      createComponent(
        data: {
          heading: $heading
          showHeading: false
          componentType: BodyText
          body: $body
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
    slug:
      slugify(articleData.contentBlock.title) ||
      `slug-${Math.floor(Math.random() * 10000) + 1}`,
    mainBody: articleData.contentBlock.message,
    asideBody: articleData.contentBlock.aside,
  };
  const mutationVariablesString = JSON.stringify(mutationVariables, null, 2);
  console.log("Variables extracted from text file: ", mutationVariablesString);

  const bodyTextMutationResult = await newDataClient.request(bodyTextMutation, {
    body: mutationVariables.mainBody.raw,
    heading: mutationVariables.title,
  });
  const bodyTextContentBlockID = bodyTextMutationResult.createComponent.id;

  const asideAndBodyCollectionMutation = gql`
    mutation CreateAsideAndBodyCollection($id: ID!, $asideBody: RichTextAST!) {
      createCollection(
        data: {
          name: "Aside & Body"
          showHeading: false
          heading: "Aside & Body Collection Heading"
          collectionType: AsideAndBody
          contents: { connect: { Component: { id: $id } } }
          body: $asideBody
        }
      ) {
        id
      }
    }
  `;

  const asideAndBodyCollectionMutationResult = await newDataClient.request(
    asideAndBodyCollectionMutation,
    { id: bodyTextContentBlockID, asideBody: mutationVariables.asideBody.raw }
  );
  const asideAndBodyCollectionID =
    asideAndBodyCollectionMutationResult.createCollection.id;

  const articleMutation = gql`
    mutation CreateArticle($id: ID!) {
      createArticle(
        data: {
          title: "title"
          date: "1996-03-15"
          description: "hello"
          slug: "this-is-a-slug-example"
          indexed: true
          hidden: false
          featuredImage: {}
          content: { connect: { Collection: { id: $id } } }
        }
      ) {
        id
      }
    }
  `;

  const articleMutationResult = await newDataClient.request(articleMutation, {
    id: asideAndBodyCollectionID,
  });
  return articleMutationResult.createArticle.id;
}

transferOldArticlesToNewCMS()
  .then((value) => console.log(`Article created with ID: ${value}`))
  .catch((error) => console.error("Oops:", error));
