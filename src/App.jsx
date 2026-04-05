import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import CalendarPage from './pages/CalendarPage'
import Services from './pages/Services'
import Commission from './pages/Commission'
import Expenses from './pages/Expenses'
import Reports from './pages/Reports'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="services" element={<Services />} />
          <Route path="commission" element={<Commission />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="reports" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
