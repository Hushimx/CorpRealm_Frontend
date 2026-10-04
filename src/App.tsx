import { BrowserRouter, Link, Route, Routes } from 'react-router'
import { GuestOnly, HomeRedirect, RequireAccount, RequireOffice } from './components/AuthGate'
import { Shell } from './components/Shell'
import { AvatarPage } from './pages/AvatarPage'
import { BuilderPage } from './pages/BuilderPage'
import { LoginPage } from './pages/LoginPage'
import { OfficePage } from './pages/OfficePage'
import { RegisterPage } from './pages/RegisterPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<HomeRedirect />} />
          <Route path="login" element={<GuestOnly><LoginPage /></GuestOnly>} />
          <Route path="register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
          <Route path="avatar" element={<RequireAccount><AvatarPage /></RequireAccount>} />
          <Route path="office" element={<RequireOffice><OfficePage /></RequireOffice>} />
          <Route path="build" element={<RequireOffice><BuilderPage /></RequireOffice>} />
          <Route path="*" element={<MissingPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

function MissingPage() {
  return (
    <main className="px-5 py-16 text-ink md:px-8">
      <h1 className="font-black text-4xl">This path is empty.</h1>
      <Link to="/" className="mt-5 inline-block text-sm font-medium text-lift underline">
        Back home
      </Link>
    </main>
  )
}
