import { gql, GraphQLClient, request } from "graphql-request";
import * as dotenv from "dotenv";
import * as fs from "fs";
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

interface MutationVariables {
  title: string;
  mainBody: IRichText;
  asideBody: IRichText;
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
  fs.writeFile("queryOutput.txt", JSON.stringify(data), (err) => {
    if (err) throw err;
  });

  // Mutation to add articles to new CMS project
  const mutation = gql`
    mutation AddOldArticleToNewProject($title: String!, $mainBody: RichTextAST!, $asideBody: RichTextAST!) {
      createArticle(
        data: {title: $title, date: "2023-02-03T01:00:00Z", description: "Article model doesn't have a summary field yet. We might put this in, but then where would it come from on the original content block?", slug: $title.toLowerCase().replace(/ /g,'-').replace(/[^\w-]+/g,''), indexed: true, hidden: false, featuredImage: {}, content: {create: {Collection: {name: "Aside & Body Title", showHeading: false, heading: "AsideAndBody Collection Heading", collectionType: AsideAndBody, body: $asideBody, contents: {create: {Component: {heading: "heading for the main body component", showHeading: false, componentType: BodyText, body: $mainBody}}}}}}}
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
  fs.readFile("queryOutput.txt", "utf8", function (err, data) {
    if (err) {
      throw err;
    }
    const articleData = JSON.parse(data);
    const mutationVariables: MutationVariables = {
      title: articleData.contentBlock.title,
      mainBody: articleData.contentBlock.message,
      asideBody: articleData.contentBlock.aside,
    };
    console.log(mutationVariables);
    executeMutation(mutationVariables).then(
      function (value) {
        console.log(value);
      },
      function (error) {
        console.log(error);
      }
    );
  });

  async function executeMutation(mutationVariables: MutationVariables) {
    const request = await newDataClient.request(mutation, mutationVariables);
    return request;
  }
}

transferOldArticlesToNewCMS()
  .then(() => console.log("Job complete!"))
  .catch(console.error);
