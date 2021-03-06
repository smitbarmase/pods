import { ApolloClient, HttpLink, InMemoryCache, split } from "@apollo/client";
import { WebSocketLink } from "@apollo/client/link/ws";
import { getMainDefinition } from "@apollo/client/utilities";

import { __prod__ } from "../constants/constant";

import { pagination } from "../utils/fetch-policies";

const httpLink = new HttpLink({
  uri: __prod__
    ? process.env.REACT_APP_SERVER
    : "http://localhost:4000/graphql",
  credentials: "include",
});

const wsLink = new WebSocketLink({
  uri: "ws://localhost:4000/graphql",
  options: {
    reconnect: true,
  },
});

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === "OperationDefinition" &&
      definition.operation === "subscription"
    );
  },
  wsLink,
  httpLink
);

const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Invite: {
        keyFields: ["invitee", ["id"], "pod", ["id"]],
      },
      Query: {
        fields: {
          messages: {
            keyArgs: ["podId"],
            merge: pagination,
          },
        },
      },
    },
  }),
});

export default client;
