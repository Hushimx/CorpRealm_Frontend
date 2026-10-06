import { BrowserRouter, Link, Route, Routes } from 'react-router'
import { GuestOnly, HomeRedirect, RequireAccount, RequireOffice } from './components/AuthGate'
import { Shell } from './components/Shell'
import { LanguageSync, useT } from './i18n'
import { AvatarPage } from './pages/AvatarPage'
import { BuilderPage } from './pages/BuilderPage'
import { DesktopPage } from './pages/DesktopPage'
import { LoginPage } from './pages/LoginPage'
import { OfficePage } from './pages/OfficePage'
import { RegisterPage } from './pages/RegisterPage'

export default function App() {
  return (
    <BrowserRouter>
      <LanguageSync />
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<HomeRedirect />} />
          <Route path="login" element={<GuestOnly><LoginPage /></GuestOnly>} />
          <Route path="register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
          <Route path="avatar" element={<RequireAccount><AvatarPage /></RequireAccount>} />
          <Route path="office" element={<RequireOffice><OfficePage /></RequireOffice>} />
          <Route path="desktop" element={<RequireOffice><DesktopPage /></RequireOffice>} />
          <Route path="build" element={<RequireOffice><BuilderPage /></RequireOffice>} />
          <Route path="*" element={<MissingPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

function MissingPage() {
  const t = useT()
  return (
    <main className="px-5 py-16 text-ink md:px-8">
      <h1 className="font-black text-4xl">{t('emptyPath')}</h1>
      <Link to="/" className="mt-5 inline-block text-sm font-medium text-lift underline">
        {t('backHome')}
      </Link>
    </main>
  )
}
