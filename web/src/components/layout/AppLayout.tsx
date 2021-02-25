import { gql, useApolloClient } from "@apollo/client";
import { Redirect, Route, Switch } from "react-router-dom";

// Routes
import { HOME, POD } from "../../constants/routes";

// Pages
import Home from "../../pages/user/Home";

import { MeQuery } from "../../generated/graphql";

import PodPage from "../PodPage";

interface AppLayoutProps {
  me: MeQuery["me"];
}

const AppLayout: React.FC<AppLayoutProps> = ({ me }) => {
  return (
    <Switch>
      <Route exact path={HOME} render={() => <Home me={me} />} />
      <Route path={POD} render={(props) => <PodPage {...props} />} />
      <Redirect to={HOME} />
    </Switch>
  );
};

export default AppLayout;
