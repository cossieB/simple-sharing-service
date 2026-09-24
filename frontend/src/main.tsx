import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "./styles/index.css"
import '@aws-amplify/ui-react/styles/reset.layer.css' // global CSS reset
import '@aws-amplify/ui-react/styles/base.layer.css' // base styling needed for Amplify UI
import '@aws-amplify/ui-react/styles/button.layer.css' // component specific styles
import { Amplify } from 'aws-amplify'
import { Authenticator } from '@aws-amplify/ui-react'
import "@aws-amplify/ui-react/styles.css";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { UploadRoute } from './routes/upload.tsx'

const router = createBrowserRouter([{
    path: "/",
    element: <div>Hello World</div>,
}, {
    path: "/create",
    element: <UploadRoute />
}]);

Amplify.configure({
    Auth: {
        Cognito: {
            userPoolId: import.meta.env.VITE_USER_POOL_ID,
            userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
            signUpVerificationMethod: 'code',

        }
    }
});

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Authenticator>
            <RouterProvider router={router} />
        </Authenticator>
    </StrictMode>,
)
