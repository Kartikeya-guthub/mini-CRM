import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Segments from './pages/Segments'
import NewCampaign from './pages/NewCampaign'
import CampaignDetail from './pages/CampaignDetail'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/segments" element={<Segments />} />
          <Route path="/campaigns/new" element={<NewCampaign />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
