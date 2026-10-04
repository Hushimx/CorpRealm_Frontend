import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { AuthField, AuthForm, AuthScreen } from '../components/AuthScreen'
import { ApiError } from '../net/api'
import { useSession } from '../net/session'

export function RegisterPage() {
  const register = useSession((state) => state.register)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (name.trim().length === 0) {
      setError('Add the name people will see in the office.')
      return
    }
    if (password.length < 8) {
      setError('Use a password of at least 8 characters.')
      return
    }
    setPending(true)
    try {
      await register(email, password, name.trim())
      navigate('/avatar', { replace: true })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the account.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthScreen eyebrow="CORP Realm" title="Create an account" lede="After this, you choose an avatar. The office stays closed until both are done.">
      <AuthForm
        onSubmit={(event) => void submit(event)}
        error={error}
        pending={pending}
        submitLabel="Create account"
        footer={
          <>
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-lift underline decoration-lift/40 underline-offset-2">
              Sign in
            </Link>
          </>
        }
      >
        <AuthField label="Name" type="text" value={name} autoComplete="nickname" placeholder="Ada" onChange={setName} />
        <AuthField label="Email" type="email" value={email} autoComplete="email" placeholder="you@studio.test" onChange={setEmail} />
        <AuthField label="Password" type="password" value={password} autoComplete="new-password" placeholder="At least 8 characters" onChange={setPassword} />
      </AuthForm>
    </AuthScreen>
  )
}
