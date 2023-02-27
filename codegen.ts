const config = {
  schema: "https://localhost:4000/graphql",
  documents: ["src/**/*.ts"],
  generates: {
    "./src/gql/": { preset: "client" },
  },
};
export default config;
