import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { AuthField, AuthForm, AuthScreen } from '../components/AuthScreen'
import { ApiError } from '../net/api'
import { useSession } from '../net/session'

export function LoginPage() {
  const login = useSession((state) => state.login)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      await login(email, password)
      const user = useSession.getState().user
      navigate(user?.avatarReady ? '/office' : '/avatar', { replace: true })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not sign in.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthScreen eyebrow="CORP Realm" title="Sign in" lede="The office opens after you sign in and choose an avatar.">
      <AuthForm
        onSubmit={(event) => void submit(event)}
        error={error}
        pending={pending}
        submitLabel="Sign in"
        footer={
          <>
            Need an account?{' '}
            <Link to="/register" className="font-medium text-lift underline decoration-lift/40 underline-offset-2">
              Create one
            </Link>
          </>
        }
      >
        <AuthField label="Email" type="email" value={email} autoComplete="username" placeholder="you@studio.test" onChange={setEmail} />
        <AuthField label="Password" type="password" value={password} autoComplete="current-password" placeholder="Password" onChange={setPassword} />
      </AuthForm>
    </AuthScreen>
  )
}
