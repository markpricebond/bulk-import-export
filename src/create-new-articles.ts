import { gql, GraphQLClient } from "graphql-request";
import * as dotenv from "dotenv";
import { grabOldArticleInfo } from "./export-old-articles.js";
import { INewArticleVariables } from "./export-old-articles.js";
import { uploadAssetToCMS } from "./upload-article-hero-images.js";
dotenv.config();

async function createNewArticle(
  singleArticleVars: INewArticleVariables,
  imageHeroVars: {
    assetID: string;
    imageHeroHeading: string;
    visualName: string;
  }
) {
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
      $assetID: ID!
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
    mutation CreateArticle($imageHeroComponentID: ID!) {
      createArticle(
        data: {
          title: "title"
          date: "1996-03-15"
          description: "Random description for now..."
          slug: "this-is-a-slug-example"
          indexed: true
          hidden: false
          featuredImage: {}
          content: { connect: { Component: { id: $imageHeroComponentID } } }
        }
      ) {
        id
      }
    }
  `;

  // Update the article just created, to add the collection of type AsideAndBody
  const updateArticleMutation = gql`
    mutation AddAsideAndBodyToArticle(
      $asideAndBodyCollectionID: ID!
      $articleID: ID!
    ) {
      updateArticle(
        data: {
          content: {
            connect: {
              Collection: { where: { id: $asideAndBodyCollectionID } }
            }
          }
        }
        where: { id: $articleID }
      ) {
        id
      }
    }
  `;

  // create body text to retrieve ID
  const bodyTextMutationResult = await newDataClient.request(bodyTextMutation, {
    body: singleArticleVars.body,
    heading: singleArticleVars.heading,
  });
  const bodyTextComponentID = bodyTextMutationResult.createComponent.id;

  // use that ID to create asideAndBody, retrieve an ID for this
  const asideAndBodyCollectionMutationResult = await newDataClient.request(
    asideAndBodyCollectionMutation,
    {
      id: bodyTextComponentID,
      asideBody: singleArticleVars.aside,
    }
  );
  const asideAndBodyCollectionID =
    asideAndBodyCollectionMutationResult.createCollection.id;

  // create an image hero, at the moment we are using the same image, but once we've checked it works we can plug the ID from asset in here
  const imageHeroMutationResult = await newDataClient.request(
    imageHeroMutation,
    imageHeroVars
  );
  const imageHeroComponentID = imageHeroMutationResult.createComponent.id;

  // use the image hero ID to create a new article with an image hero
  const articleMutationResult = await newDataClient.request(articleMutation, {
    imageHeroComponentID: imageHeroComponentID,
  });

  // update the article to include the AsideAndBody, using the ID we gathered earlier
  const articleUpdateResult = await newDataClient.request(
    updateArticleMutation,
    {
      articleID: articleMutationResult.createArticle.id,
      asideAndBodyCollectionID: asideAndBodyCollectionID,
    }
  );

  return articleUpdateResult.updateArticle.id;
}

grabOldArticleInfo()
  .then((value) => {
    value.forEach((singleArticleVars) => {
      uploadAssetToCMS(singleArticleVars.heroImageRemoteURL).then((value) => {
        createNewArticle(singleArticleVars, value)
          .then((value) => console.log(`Article created with ID\n${value}`))
          .catch((error) => console.error("createNewArticles failed:", error));
      });
    });
  })
  .catch((error) => console.error("grabOldArticleInfo failed: ", error));
