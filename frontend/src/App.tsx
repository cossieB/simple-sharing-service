import { useAuthenticator } from '@aws-amplify/ui-react'

function App() {
  const auth = useAuthenticator()

  return (
    <button >
      Sign In
    </button>
  )
}

export default App
