import { gql, GraphQLClient } from "graphql-request";
import * as dotenv from "dotenv";
import { grabOldArticleInfo } from "./export-old-articles.js";
import { INewArticleVariables } from "./export-old-articles.js";
import { uploadAssetToCMS } from "./upload-article-hero-images.js";
import pThrottle from "p-throttle";
import slugify from "@sindresorhus/slugify";
dotenv.config();

const throttler = pThrottle({ limit: 2, interval: 1000 });

const createNewArticle = async (
  singleArticleVars: INewArticleVariables,
  imageHeroVars?: {
    assetID: string;
    imageHeroHeading: string;
    visualName: string;
  }
): Promise<string> => {
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
    mutation CreateArticle(
      $articleTitle: String!
      $articleSlug: String!
      $imageHeroComponentID: ID!
    ) {
      createArticle(
        data: {
          title: $articleTitle
          date: "1996-03-15"
          description: "Random description for now..."
          slug: $articleSlug
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

  // same mutation as above but without image hero
  const articleWithoutImageMutation = gql`
    mutation CreateArticle($articleTitle: String!, $articleSlug: String!) {
      createArticle(
        data: {
          title: $articleTitle
          date: "1996-03-15"
          description: "Random description for now..."
          slug: $articleSlug
          indexed: true
          hidden: false
          featuredImage: {}
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

  // create an image hero
  const imageHeroMutationResult = imageHeroVars
    ? await newDataClient.request(imageHeroMutation, imageHeroVars)
    : undefined;

  const imageHeroComponentID = imageHeroMutationResult
    ? imageHeroMutationResult.createComponent.id
    : undefined;

  // use the image hero ID to create a new article with an image hero
  const articleMutationResult = imageHeroComponentID
    ? await newDataClient.request(articleMutation, {
        articleTitle: singleArticleVars.heading,
        articleSlug: singleArticleVars.slug,
        imageHeroComponentID: imageHeroComponentID,
      })
    : await newDataClient.request(articleWithoutImageMutation, {
        articleTitle: singleArticleVars.heading,
        articleSlug: singleArticleVars.slug,
      });

  // update the article to include the AsideAndBody, using the ID we gathered earlier
  const articleUpdateResult: { updateArticle: { id: string } } =
    await newDataClient.request(updateArticleMutation, {
      articleID: articleMutationResult.createArticle.id,
      asideAndBodyCollectionID: asideAndBodyCollectionID,
    });

  return articleUpdateResult.updateArticle.id;
};

async function grabStuff() {
  const info = await grabOldArticleInfo();
  for (const article of info) {
    console.log("This is the articles details", article);
    const result = await uploadAssetToCMS(article.heroImageRemoteURL);
    console.log(
      result
        ? `Uploaded asset to CMS\n ${result}`
        : `No asset to upload for image hero`
    );
    const newArticle = result
      ? await createNewArticle(article, result)
      : await createNewArticle(article);
  }
}

grabStuff()
  .then((res) => console.log("done"))

  .catch((error) => console.log(error));

// grabOldArticleInfo().then((value) => {
//   value.forEach((singleArticleVars) => {
//     try {
//       console.log(singleArticleVars.heroImageRemoteURL);
//       uploadAssetToCMS(singleArticleVars.heroImageRemoteURL)
//         .then((res) => {
//           console.log(res);
//           return createNewArticle(singleArticleVars, res);
//         })
//         .catch((error) => console.log(error));
//     } catch (error) {
//       console.log(error);
//     }
//   });
// });

// grabOldArticleInfo()
//   .then((value) => {
//     value.forEach((singleArticleVars) => {
//       try {
//         uploadAssetToCMS(singleArticleVars.heroImageRemoteURL).then(
//           (response) => {
//             console.log(response);
//             createNewArticle(singleArticleVars, response).then((articleID) =>
//               console.log(`New article created, ID: ${articleID}`)
//             );
//           }
//         );
//       } catch (error) {
//         if (error) {
//           console.log("createNewArticle failed:\n");
//           return error.message;
//         }
//       }
//     });
//   })
//   .catch((error) => console.error("grabOldArticleInfo failed: ", error));
