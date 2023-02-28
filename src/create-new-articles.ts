import { gql, GraphQLClient } from "graphql-request";
import * as dotenv from "dotenv";
import { readFile, writeFile } from "fs/promises";
import slugify from "@sindresorhus/slugify";
import { grabOldArticleInfo } from "./export-old-articles";
dotenv.config();

async function createNewArticles() {
  let mutationVariables;
  grabOldArticleInfo()
    .then((value) => {
      mutationVariables = value;
      console.log(`These are the variables for our mutation: ${value}`);
    })
    .catch((error) => console.error("Oops:", error));

  // Credentials and endpoint for the new CMS project
  const newDataClient = new GraphQLClient(
    process.env.PROJECT_2_GRAPHCMS_ENDPOINT,
    {
      headers: {
        authorization: `Bearer ${process.env.PROJECT_2_GRAPHCMS_TOKEN}`,
      },
    }
  );

  // Create a single component of type BodyText
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
