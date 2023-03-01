import { gql, GraphQLClient } from "graphql-request";
import * as dotenv from "dotenv";
import { grabOldArticleInfo } from "./export-old-articles.js";
import { INewArticleVariables } from "./export-old-articles.js";
dotenv.config();

async function createNewArticle(singleArticleVars: INewArticleVariables) {
  // Credentials and endpoint for the new CMS project
  const newDataClient = new GraphQLClient(
    process.env.PROJECT_2_GRAPHCMS_ENDPOINT,
    {
      headers: {
        authorization: `Bearer ${process.env.PROJECT_2_GRAPHCMS_TOKEN}`,
      },
    }
  );

  // Create a component of type BodyText
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

  // Create a component of type Hero using the created asset TO DO
  const imageHeroMutation = gql`
    mutation CreateAnImageHero(
      $imageHeroHeading: String!
      $assetID: String!
      $visualName: String!
    ) {
      createComponent(
        data: {
          heading: $imageHeroHeading
          showHeading: false
          componentType: Hero
          visual: {
            create: {
              mainAsset: { connect: { id: $assetID } }
              name: $visualName
            }
          }
        }
      ) {
        id
      }
    }
  `;

  // Create a collection of type AsideAndBody, and put the BodyText component inside
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

  // Create an article, and put the AsideAndBody component inside
  const articleMutation = gql`
    mutation CreateArticle(
      $asideAndBodyCollectionID: ID!
      $imageHeroComponentID: ID!
    ) {
      createArticle(
        data: {
          title: "title"
          date: "1996-03-15"
          description: "Random description for now..."
          slug: "this-is-a-slug-example"
          indexed: true
          hidden: false
          featuredImage: {}
          content: {
            connect: {
              Collection: { id: $asideAndBodyCollectionID }
              Component: { id: $imageHeroComponentID }
            }
          }
        }
      ) {
        id
      }
    }
  `;

  const bodyTextMutationResult = await newDataClient.request(bodyTextMutation, {
    body: singleArticleVars.body,
    heading: singleArticleVars.heading,
  });
  const bodyTextComponentID = bodyTextMutationResult.createComponent.id;

  const imageHeroMutationResult = await newDataClient.request(
    imageHeroMutation,
    {
      // TO DO: Get an actual asset to use for these variables
      $imageHeroHeading: "Get this from asset filename",
      $assetID: Math.floor(Math.random() * 1000) + 1,
      visualName: "Get this from asset alternate text",
    }
  );
  const imageHeroComponentID = imageHeroMutationResult.createComponent.id;

  const asideAndBodyCollectionMutationResult = await newDataClient.request(
    asideAndBodyCollectionMutation,
    {
      id: bodyTextComponentID,
      asideBody: singleArticleVars.aside,
    }
  );
  const asideAndBodyCollectionID =
    asideAndBodyCollectionMutationResult.createCollection.id;

  const articleMutationResult = await newDataClient.request(articleMutation, {
    asideAndBodyCollectionID: asideAndBodyCollectionID,
    imageHeroComponentID: imageHeroComponentID,
  });
  return articleMutationResult.createArticle.id;
}

grabOldArticleInfo()
  .then((value) => {
    value.forEach((singleArticleVars) => {
      createNewArticle(singleArticleVars)
        .then((value) => console.log(`Article created with ID\n${value}`))
        .catch((error) => console.error("createNewArticles failed:", error));
    });
  })
  .catch((error) => console.error("grabOldArticleInfo failed: ", error));
