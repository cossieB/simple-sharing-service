import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import "@aws-amplify/ui-react/styles/reset.layer.css";
import "@aws-amplify/ui-react/styles/base.layer.css";
import "@aws-amplify/ui-react/styles/button.layer.css";
import "@aws-amplify/ui-react/styles.css";
import { Amplify } from "aws-amplify";
import { Authenticator } from "@aws-amplify/ui-react";
import App from "./App";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
      signUpVerificationMethod: "code",
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Authenticator loginMechanisms={["email"]}>
      {({ user }): any => (user ? <App /> : null)}
    </Authenticator>
  </StrictMode>,
);
