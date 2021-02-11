import { useEffect, useState } from "react";
import { gql, useApolloClient } from "@apollo/client";
import {
  generatePath,
  Link,
  useLocation,
  match,
  useParams,
  matchPath,
  useRouteMatch,
} from "react-router-dom";

// Graphql
import { MeQuery } from "../../generated/graphql";
import Home from "../../pages/user/Home";

// Routes
import {
  HOME,
  POD,
  POD_BOARD,
  POD_DISCUSSION,
  POD_SETTINGS,
} from "../../constants/routes";

// Constants
import podOptions from "../../constants/podOptions";

export interface RouteParams {
  id: string;
}

const Navbar: React.FC = () => {
  const client = useApolloClient();
  const location = useLocation();
  const params = useParams<RouteParams>();

  const data = client.readQuery<MeQuery>({
    query: gql`
      query Me {
        me {
          id
        }
      }
    `,
  });

  const isAuth = !!data?.me;

  return (
    <div className="sticky top-0 flex justify-center border-b border-gray-200">
      <div className="w-full max-w-6xl px-2 space-y-1">
        <div className="h-16 flex items-center justify-between">
          <div className="flex items-center space-x-5">
            <Link to="/" className="text-gray-900 text-3xl font-extrabold">
              Pods
            </Link>
          </div>
          {isAuth ? (
            <div>Heee</div>
          ) : (
            <div className="flex items-center space-x-5">
              <Link to="/login" className="text-gray-900 text-sm">
                Login
              </Link>
              <Link
                to="/signup"
                className="bg-gray-900 text-white px-2.5 py-2 rounded border border-gray-900 text-sm hover:bg-white hover:text-black"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
        {isAuth && matchPath(location.pathname, POD)?.isExact && (
          <div className="flex space-x-6">
            {podOptions.map(({ name, route }, index) => (
              <Link
                to={generatePath(route, { id: params.id })}
                key={index}
                className="text-gray-500 border-b-2 text-sm hover:border-gray-900 border-transparent hover:text-gray-900 pb-2.5"
              >
                {name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Navbar;
