import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import {
  Bell,
  Building2,
  CalendarDays,
  Camera,
  ChevronDown,
  CircleDollarSign,
  FileText,
  HardHat,
  Home,
  LayoutGrid,
  LogOut,
  Pencil,
  PieChart as PieChartIcon,
  Plus,
  Receipt,
  ScanLine,
  Search,
  Settings2,
  Trash2,
  TrendingUp,
  Users,
  WalletCards,
  X,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type Project = {
  id: string
  user_id: string
  name: string
  total_area: number | null
  start_date: string | null
  status: string
  estimated_sale_value: number | null
  created_at: string
  updated_at: string
}

type Partner = {
  id: string
  project_id: string
  name: string
  share_percent: number
}

type CostCenter = {
  id: string
  project_id: string
  name: string
  category: string | null
  planned_budget: number
  created_at: string
  updated_at: string
}

type Invoice = {
  id: string
  project_id: string
  invoice_number: string
  supplier: string | null
  issue_date: string | null
  total_amount: number
  notes: string | null
  created_at: string
  updated_at: string
}

type InvoiceItem = {
  id: string
  invoice_id: string
  cost_center_id: string | null
  subcategory_id?: string | null
  description: string
  category: string | null
  amount: number
  quantity: number
  created_at: string
}

type InvoiceItemPayload = {
  description: string
  quantity: number
  amount: number
  costCenterId: string
}

type ProjectPayload = {
  name: string
  totalArea: number
  startDate: string
  status: string
  estimatedSaleValue: number
}

type PartnerPayload = {
  name: string
  sharePercent: number
}

type CostCenterPayload = {
  name: string
  category: string
  plannedBudget: number
}

type InvoicePayload = {
  invoiceNumber: string
  supplier: string
  issueDate: string
  notes: string
  items: InvoiceItemPayload[]
}

const PROJECT_LIMIT = 10
const COST_CENTER_LIMIT = 40

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`
}

function numberValue(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.').trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeItemName(value: string) {
  return value.trim().toLowerCase()
}

function getProjectStorageKey(userId: string) {
  return `rp-obra-tracker:selected-project:${userId}`
}

function createEmptyInvoiceItemPayload(): InvoiceItemPayload {
  return {
    description: '',
    quantity: 1,
    amount: 0,
    costCenterId: '',
  }
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  const [partners, setPartners] = useState<Partner[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([])

  const [appLoading, setAppLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterCenterId, setFilterCenterId] = useState('')

  const [showAllCenters, setShowAllCenters] = useState(false)
  const [showAllInvoices, setShowAllInvoices] = useState(false)

  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const [partnerModalOpen, setPartnerModalOpen] = useState(false)
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null)

  const [costCenterModalOpen, setCostCenterModalOpen] = useState(false)
  const [editingCostCenter, setEditingCostCenter] = useState<CostCenter | null>(null)

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)

  useEffect(() => {
    let mounted = true

    async function bootstrapAuth() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session)
      setAuthLoading(false)
    }

    bootstrapAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setErrorMessage(null)
      setSuccessMessage(null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    setSearchDraft(searchTerm)
  }, [searchTerm])

  useEffect(() => {
    if (!session?.user?.id) {
      setProjects([])
      setSelectedProjectId(null)
      setPartners([])
      setCostCenters([])
      setInvoices([])
      setInvoiceItems([])
      return
    }

    void loadProjects(session.user.id)
  }, [session?.user?.id])

  useEffect(() => {
    if (!selectedProjectId) {
      setPartners([])
      setCostCenters([])
      setInvoices([])
      setInvoiceItems([])
      return
    }

    void loadProjectDetails(selectedProjectId)
  }, [selectedProjectId])

  async function loadProjects(userId: string) {
    setAppLoading(true)
    setErrorMessage(null)

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      setErrorMessage(error.message)
      setAppLoading(false)
      return
    }

    const projectList = (data ?? []) as Project[]
    setProjects(projectList)

    const storageKey = getProjectStorageKey(userId)
    const storedProjectId = localStorage.getItem(storageKey)

    if (projectList.length === 0) {
      setSelectedProjectId(null)
      setProjectModalOpen(true)
      setEditingProject(null)
      setAppLoading(false)
      return
    }

    const validStored = projectList.find((project) => project.id === storedProjectId)
    const nextSelectedId = validStored?.id ?? projectList[0].id
    setSelectedProjectId(nextSelectedId)
    localStorage.setItem(storageKey, nextSelectedId)
    setAppLoading(false)
  }

  async function loadProjectDetails(projectId: string) {
    setAppLoading(true)
    setErrorMessage(null)

    const [partnersResult, costCentersResult, invoicesResult] = await Promise.all([
      supabase.from('partners').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
      supabase.from('cost_centers').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
      supabase.from('invoices').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    ])

    if (partnersResult.error || costCentersResult.error || invoicesResult.error) {
      setErrorMessage(
        partnersResult.error?.message ||
          costCentersResult.error?.message ||
          invoicesResult.error?.message ||
          'Erro ao carregar dados.',
      )
      setAppLoading(false)
      return
    }

    const invoiceList = (invoicesResult.data ?? []) as Invoice[]
    const invoiceIds = invoiceList.map((invoice) => invoice.id)

    let items: InvoiceItem[] = []

    if (invoiceIds.length > 0) {
      const itemsResult = await supabase
        .from('invoice_items')
        .select('*')
        .in('invoice_id', invoiceIds)
        .order('created_at', { ascending: true })

      if (itemsResult.error) {
        setErrorMessage(itemsResult.error.message)
        setAppLoading(false)
        return
      }

      items = (itemsResult.data ?? []) as InvoiceItem[]
    }

    setPartners((partnersResult.data ?? []) as Partner[])
    setCostCenters((costCentersResult.data ?? []) as CostCenter[])
    setInvoices(invoiceList)
    setInvoiceItems(items)
    setAppLoading(false)
  }

  async function handleSelectProject(projectId: string) {
    if (!session?.user?.id) return
    setSelectedProjectId(projectId)
    localStorage.setItem(getProjectStorageKey(session.user.id), projectId)
  }

  async function handleCreateProject(payload: ProjectPayload) {
    if (!session?.user?.id) return

    if (projects.length >= PROJECT_LIMIT) {
      setErrorMessage('Seu plano atual permite até 10 obras cadastradas.')
      return
    }

    setAppLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: session.user.id,
        name: payload.name,
        total_area: payload.totalArea,
        start_date: payload.startDate || null,
        status: payload.status,
        estimated_sale_value: payload.estimatedSaleValue,
      })
      .select()
      .single()

    if (error || !data) {
      setErrorMessage(error?.message ?? 'Não foi possível criar a obra.')
      setAppLoading(false)
      return
    }

    setSuccessMessage('Obra criada com sucesso.')
    setProjectModalOpen(false)
    await loadProjects(session.user.id)
    setSelectedProjectId(data.id)
    localStorage.setItem(getProjectStorageKey(session.user.id), data.id)
    await loadProjectDetails(data.id)
    setAppLoading(false)
  }

  async function handleUpdateProject(payload: ProjectPayload) {
    if (!editingProject) return

    setAppLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const { error } = await supabase
      .from('projects')
      .update({
        name: payload.name,
        total_area: payload.totalArea,
        start_date: payload.startDate || null,
        status: payload.status,
        estimated_sale_value: payload.estimatedSaleValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingProject.id)

    if (error) {
      setErrorMessage(error.message)
      setAppLoading(false)
      return
    }

    setSuccessMessage('Obra atualizada com sucesso.')
    setProjectModalOpen(false)
    setEditingProject(null)
    if (session?.user?.id) await loadProjects(session.user.id)
    if (selectedProjectId) await loadProjectDetails(selectedProjectId)
    setAppLoading(false)
  }

  async function handleCreatePartner(payload: PartnerPayload) {
    if (!selectedProjectId) return

    setAppLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const { error } = await supabase.from('partners').insert({
      project_id: selectedProjectId,
      name: payload.name,
      share_percent: payload.sharePercent,
    })

    if (error) {
      setErrorMessage(error.message)
      setAppLoading(false)
      return
    }

    setSuccessMessage('Sócio cadastrado.')
    setPartnerModalOpen(false)
    await loadProjectDetails(selectedProjectId)
  }

  async function handleUpdatePartner(payload: PartnerPayload) {
    if (!editingPartner || !selectedProjectId) return

    setAppLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const { error } = await supabase
      .from('partners')
      .update({
        name: payload.name,
        share_percent: payload.sharePercent,
      })
      .eq('id', editingPartner.id)

    if (error) {
      setErrorMessage(error.message)
      setAppLoading(false)
      return
    }

    setSuccessMessage('Sócio atualizado.')
    setPartnerModalOpen(false)
    setEditingPartner(null)
    await loadProjectDetails(selectedProjectId)
  }

  async function handleDeletePartner(id: string) {
    if (!selectedProjectId) return
    const ok = window.confirm('Deseja excluir este sócio?')
    if (!ok) return

    setAppLoading(true)
    const { error } = await supabase.from('partners').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
      setAppLoading(false)
      return
    }

    setSuccessMessage('Sócio excluído.')
    await loadProjectDetails(selectedProjectId)
  }

  async function handleCreateCostCenter(payload: CostCenterPayload) {
    if (!selectedProjectId) return

    if (costCenters.length >= COST_CENTER_LIMIT) {
      setErrorMessage('Cada obra pode ter até 40 centros de custo.')
      return
    }

    setAppLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const { error } = await supabase.from('cost_centers').insert({
      project_id: selectedProjectId,
      name: payload.name,
      category: payload.category || null,
      planned_budget: payload.plannedBudget,
    })

    if (error) {
      setErrorMessage(error.message)
      setAppLoading(false)
      return
    }

    setSuccessMessage('Centro de custo cadastrado.')
    setCostCenterModalOpen(false)
    await loadProjectDetails(selectedProjectId)
  }

  async function handleUpdateCostCenter(payload: CostCenterPayload) {
    if (!editingCostCenter || !selectedProjectId) return

    setAppLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const { error } = await supabase
      .from('cost_centers')
      .update({
        name: payload.name,
        category: payload.category || null,
        planned_budget: payload.plannedBudget,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingCostCenter.id)

    if (error) {
      setErrorMessage(error.message)
      setAppLoading(false)
      return
    }

    setSuccessMessage('Centro de custo atualizado.')
    setCostCenterModalOpen(false)
    setEditingCostCenter(null)
    await loadProjectDetails(selectedProjectId)
  }

  async function handleDeleteCostCenter(id: string) {
    if (!selectedProjectId) return
    const ok = window.confirm('Deseja excluir este centro de custo?')
    if (!ok) return

    setAppLoading(true)
    const { error } = await supabase.from('cost_centers').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
      setAppLoading(false)
      return
    }

    setSuccessMessage('Centro de custo excluído.')
    await loadProjectDetails(selectedProjectId)
  }

  async function handleCreateInvoice(payload: InvoicePayload) {
    if (!selectedProjectId) return

    const validItems = payload.items.filter((item) => item.description.trim() && item.amount > 0)

    if (validItems.length === 0) {
      setErrorMessage('Adicione pelo menos um item válido na nota fiscal.')
      return
    }

    const totalAmount = validItems.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)

    setAppLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        project_id: selectedProjectId,
        invoice_number: payload.invoiceNumber,
        supplier: payload.supplier || null,
        issue_date: payload.issueDate || null,
        total_amount: totalAmount,
        notes: payload.notes || null,
      })
      .select()
      .single()

    if (invoiceError || !invoiceData) {
      setErrorMessage(invoiceError?.message ?? 'Erro ao criar nota.')
      setAppLoading(false)
      return
    }

    const itemsToInsert = validItems.map((item) => ({
      invoice_id: invoiceData.id,
      cost_center_id: item.costCenterId || null,
      subcategory_id: null,
      description: item.description.trim(),
      category: null,
      amount: item.amount,
      quantity: item.quantity > 0 ? item.quantity : 1,
    }))

    const { error: itemError } = await supabase.from('invoice_items').insert(itemsToInsert)

    if (itemError) {
      setErrorMessage(itemError.message)
      setAppLoading(false)
      return
    }

    setSuccessMessage('Nota fiscal cadastrada com sucesso.')
    setInvoiceModalOpen(false)
    await loadProjectDetails(selectedProjectId)
  }

  async function handleUpdateInvoice(payload: InvoicePayload) {
    if (!editingInvoice || !selectedProjectId) return

    const validItems = payload.items.filter((item) => item.description.trim() && item.amount > 0)

    if (validItems.length === 0) {
      setErrorMessage('Adicione pelo menos um item válido na nota fiscal.')
      return
    }

    const totalAmount = validItems.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)

    setAppLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const { error: invoiceError } = await supabase
      .from('invoices')
      .update({
        invoice_number: payload.invoiceNumber,
        supplier: payload.supplier || null,
        issue_date: payload.issueDate || null,
        total_amount: totalAmount,
        notes: payload.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingInvoice.id)

    if (invoiceError) {
      setErrorMessage(invoiceError.message)
      setAppLoading(false)
      return
    }

    const { error: deleteItemsError } = await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', editingInvoice.id)

    if (deleteItemsError) {
      setErrorMessage(deleteItemsError.message)
      setAppLoading(false)
      return
    }

    const itemsToInsert = validItems.map((item) => ({
      invoice_id: editingInvoice.id,
      cost_center_id: item.costCenterId || null,
      subcategory_id: null,
      description: item.description.trim(),
      category: null,
      amount: item.amount,
      quantity: item.quantity > 0 ? item.quantity : 1,
    }))

    const { error: insertItemsError } = await supabase.from('invoice_items').insert(itemsToInsert)

    if (insertItemsError) {
      setErrorMessage(insertItemsError.message)
      setAppLoading(false)
      return
    }

    setSuccessMessage('Nota fiscal atualizada.')
    setInvoiceModalOpen(false)
    setEditingInvoice(null)
    await loadProjectDetails(selectedProjectId)
  }

  async function handleDeleteInvoice(id: string) {
    if (!selectedProjectId) return
    const ok = window.confirm('Deseja excluir esta nota fiscal?')
    if (!ok) return

    setAppLoading(true)
    const { error } = await supabase.from('invoices').delete().eq('id', id)

    if (error) {
      setErrorMessage(error.message)
      setAppLoading(false)
      return
    }

    setSuccessMessage('Nota fiscal excluída.')
    await loadProjectDetails(selectedProjectId)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  function applySearchAndClose() {
    setSearchTerm(searchDraft.trim())
    setSearchOpen(false)
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      applySearchAndClose()
    }
  }

  function clearAllFilters() {
    setSearchTerm('')
    setSearchDraft('')
    setFilterMonth('')
    setFilterCenterId('')
  }

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )

  const projectSpent = useMemo(
    () => invoiceItems.reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    [invoiceItems],
  )

  const projectSaleValue = Number(selectedProject?.estimated_sale_value ?? 0)
  const estimatedMargin = Math.max(projectSaleValue - projectSpent, 0)

  const costCentersWithExtras = useMemo(() => {
    return costCenters.map((center) => {
      const spent = invoiceItems
        .filter((item) => item.cost_center_id === center.id)
        .reduce((sum, item) => sum + Number(item.amount ?? 0), 0)

      return {
        ...center,
        spent,
      }
    })
  }, [costCenters, invoiceItems])

  const invoiceMap = useMemo(() => {
    return new Map(invoices.map((invoice) => [invoice.id, invoice]))
  }, [invoices])

  const aggregatedItems = useMemo(() => {
    const grouped = new Map<
      string,
      {
        key: string
        name: string
        totalQuantity: number
        totalAmount: number
        invoiceIds: Set<string>
        invoiceNumbers: Set<string>
        costCenterNames: Set<string>
        dates: Set<string>
      }
    >()

    for (const item of invoiceItems) {
      const normalized = normalizeItemName(item.description)
      if (!normalized) continue

      const invoice = invoiceMap.get(item.invoice_id)
      const center = costCenters.find((costCenter) => costCenter.id === item.cost_center_id)

      if (!grouped.has(normalized)) {
        grouped.set(normalized, {
          key: normalized,
          name: item.description.trim(),
          totalQuantity: 0,
          totalAmount: 0,
          invoiceIds: new Set<string>(),
          invoiceNumbers: new Set<string>(),
          costCenterNames: new Set<string>(),
          dates: new Set<string>(),
        })
      }

      const current = grouped.get(normalized)
      if (!current) continue

      current.totalQuantity += Number(item.quantity ?? 0)
      current.totalAmount += Number(item.amount ?? 0)
      current.invoiceIds.add(item.invoice_id)

      if (invoice?.invoice_number) current.invoiceNumbers.add(invoice.invoice_number)
      if (invoice?.issue_date) current.dates.add(invoice.issue_date)
      if (center?.name) current.costCenterNames.add(center.name)
    }

    return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [invoiceItems, invoiceMap, costCenters])

  const filteredAggregatedItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return []

    return aggregatedItems.filter((item) => item.name.toLowerCase().includes(term))
  }, [aggregatedItems, searchTerm])

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const items = invoiceItems.filter((item) => item.invoice_id === invoice.id)
      const term = searchTerm.toLowerCase()

      const bySearch =
        !searchTerm ||
        invoice.invoice_number.toLowerCase().includes(term) ||
        (invoice.supplier ?? '').toLowerCase().includes(term) ||
        items.some((item) => {
          const center = costCenters.find((c) => c.id === item.cost_center_id)
          return (
            item.description.toLowerCase().includes(term) ||
            (center?.name ?? '').toLowerCase().includes(term)
          )
        })

      const byMonth =
        !filterMonth || (invoice.issue_date ? invoice.issue_date.startsWith(filterMonth) : false)

      const byCenter =
        !filterCenterId || items.some((item) => item.cost_center_id === filterCenterId)

      return bySearch && byMonth && byCenter
    })
  }, [invoices, invoiceItems, costCenters, searchTerm, filterMonth, filterCenterId])

  const filteredCenters = useMemo(() => {
    return costCentersWithExtras.filter((center) => {
      if (!searchTerm) return true
      const term = searchTerm.toLowerCase()
      return (
        center.name.toLowerCase().includes(term) ||
        (center.category ?? '').toLowerCase().includes(term)
      )
    })
  }, [costCentersWithExtras, searchTerm])

  const visibleInvoices = showAllInvoices ? filteredInvoices : filteredInvoices.slice(0, 3)

  const notifications = useMemo(() => {
    const latestInvoices = invoices.slice(0, 3).map((invoice) => ({
      id: invoice.id,
      text: `Nota ${invoice.invoice_number} cadastrada ou atualizada`,
      date: invoice.issue_date || invoice.created_at.slice(0, 10),
    }))

    const centerInfo = {
      id: 'centers',
      text: `${costCenters.length} centros de custo cadastrados`,
      date: 'Agora',
    }

    return [centerInfo, ...latestInvoices]
  }, [invoices, costCenters.length])

  const centersEmptyText =
    searchTerm.trim().length > 0
      ? 'Nenhum centro de custo encontrado com os filtros atuais.'
      : 'Nenhum centro de custo cadastrado ainda.'

  if (authLoading) {
    return <LoadingScreen text="Carregando autenticação..." />
  }

  if (!session) {
    return <AuthScreen onError={setErrorMessage} onSuccess={setSuccessMessage} />
  }

  if (!selectedProject && !projectModalOpen) {
    return <LoadingScreen text="Carregando obras..." />
  }

  return (
    <main className="app-shell min-h-screen px-4 pb-28 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="glass-card mb-6 rounded-[36px] p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="primary-card flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] text-white">
                <HardHat size={28} />
              </div>

              <div>
                <p className="mb-1 text-base text-[#587096]">Sistema de obras</p>
                <h1 className="text-[2.3rem] font-semibold leading-none tracking-[-0.06em] text-[#14213d] sm:text-[3rem]">
                  RP OBRA TRACKER
                </h1>
                <p className="mt-2 max-w-2xl text-base text-[#6981a8]">
                  Gestão visual de obras, centros de custo e notas fiscais.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
              <button
                onClick={() => setSearchOpen(true)}
                className="glass-card relative flex h-14 w-14 items-center justify-center rounded-[20px] text-[#17345f]"
              >
                <Search size={22} />
              </button>

              <button
                onClick={() => setNotificationsOpen(true)}
                className="glass-card relative flex h-14 w-14 items-center justify-center rounded-[20px] text-[#17345f]"
              >
                <Bell size={22} />
                {notifications.length > 0 ? (
                  <span className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-[#ff4d7e]" />
                ) : null}
              </button>

              <button
                onClick={() => {
                  setEditingProject(null)
                  setProjectModalOpen(true)
                }}
                className="soft-pill inline-flex items-center gap-2 rounded-[20px] px-4 py-3 text-sm font-semibold"
              >
                <Plus size={16} />
                Nova obra
              </button>

              <button
                onClick={handleLogout}
                className="soft-pill inline-flex items-center gap-2 rounded-[20px] px-4 py-3 text-sm font-semibold"
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </div>
        </header>

        {errorMessage ? <MessageBanner type="error" message={errorMessage} /> : null}
        {successMessage ? <MessageBanner type="success" message={successMessage} /> : null}

        {selectedProject ? (
          <>
            <div className="grid gap-6 xl:grid-cols-[1.18fr_0.92fr]">
              <section className="glass-card h-full rounded-[36px] p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <div className="soft-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium">
                        <Building2 size={14} />
                        Obra selecionada
                      </div>
                      <span className="text-sm font-medium text-[#6c84aa]">
                        {projects.length} / {PROJECT_LIMIT} obras
                      </span>
                    </div>

                    <h2 className="text-[2.1rem] font-semibold leading-none tracking-[-0.05em] text-[#14213d] sm:text-[2.5rem]">
                      {selectedProject.name}
                    </h2>

                    <div className="mt-4 flex flex-wrap gap-2.5">
                      <InfoBadge icon={<LayoutGrid size={14} />} label={`${Number(selectedProject.total_area ?? 0)} m²`} />
                      <InfoBadge icon={<CalendarDays size={14} />} label={selectedProject.start_date || 'Sem data'} />
                      <InfoBadge icon={<HardHat size={14} />} label={`Status: ${selectedProject.status}`} />
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 sm:items-end">
                    <div className="relative min-w-[190px]">
                      <select
                        value={selectedProject.id}
                        onChange={(event) => handleSelectProject(event.target.value)}
                        className="soft-pill min-w-[190px] appearance-none rounded-[22px] px-5 py-3 pr-10 text-base font-semibold outline-none"
                      >
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={18}
                        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#2f7df6]"
                      />
                    </div>

                    <button
                      onClick={() => {
                        setEditingProject(selectedProject)
                        setProjectModalOpen(true)
                      }}
                      className="soft-pill inline-flex items-center gap-2 rounded-[16px] px-4 py-2.5 text-sm font-semibold"
                    >
                      <Pencil size={14} />
                      Editar obra
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    title="Custo atual"
                    value={formatCurrency(projectSpent)}
                    icon={<WalletCards size={18} />}
                    highlight
                  />
                  <StatCard
                    title="Venda estimada"
                    value={formatCurrency(projectSaleValue)}
                    icon={<CircleDollarSign size={18} />}
                  />
                  <StatCard
                    title="Margem estimada"
                    value={formatCurrency(estimatedMargin)}
                    icon={<TrendingUp size={18} />}
                  />
                  <StatCard
                    title="Notas"
                    value={String(invoices.length)}
                    icon={<Receipt size={18} />}
                  />
                </div>
              </section>

              <section className="glass-card h-full rounded-[36px] p-5 sm:p-6">
                <SectionHeader
                  title="Cadastro de nota fiscal"
                  subtitle="Lançamento manual"
                  action="MVP"
                />

                <div className="mt-5 flex h-[calc(100%-3.25rem)] min-h-[280px] flex-col justify-center rounded-[32px] border-2 border-dashed border-[rgba(47,125,246,0.2)] bg-[rgba(255,255,255,0.48)] p-6 text-center">
                  <div className="soft-pill mx-auto flex h-14 w-14 items-center justify-center rounded-[20px]">
                    <Receipt size={24} />
                  </div>

                  <h3 className="mt-4 text-[1.8rem] font-semibold leading-tight tracking-[-0.05em] text-[#14213d]">
                    Lançamento
                    <br />
                    manual de nota
                  </h3>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <button
                      onClick={() => {
                        setEditingInvoice(null)
                        setInvoiceModalOpen(true)
                      }}
                      className="primary-card inline-flex h-14 items-center justify-center gap-2 rounded-[20px] px-5 text-sm font-semibold whitespace-nowrap text-white"
                    >
                      <FileText size={16} />
                      Nova nota
                    </button>

                    <button
                      type="button"
                      className="soft-pill inline-flex h-14 items-center justify-center gap-2 rounded-[20px] px-5 text-sm font-semibold whitespace-nowrap opacity-85"
                    >
                      <Camera size={16} />
                      Nova nota
                    </button>
                  </div>

                  <span className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#6f87ad]">
                    Em breve leitura por câmera
                  </span>
                </div>
              </section>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.18fr_0.92fr]">
              <section className="glass-card h-full rounded-[36px] p-5 sm:p-6">
                <SectionHeader
                  title="Resumo da obra"
                  subtitle="Visão macro para apresentação"
                  action="Atual"
                />

                <div className="mt-5 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="flex items-center justify-center rounded-[30px] bg-[rgba(255,255,255,0.54)] p-5">
                    <div className="mini-ring">
                      <div className="mini-ring-content text-center">
                        <p className="text-sm text-[#6981a8]">Margem estimada</p>
                        <h3 className="mt-1 text-[1.3rem] font-semibold tracking-[-0.04em] text-[#14213d] sm:text-[1.5rem]">
                          {formatCurrency(estimatedMargin)}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[30px] bg-[rgba(255,255,255,0.54)] p-5">
                    <div className="grid gap-3">
                      <SummaryRow label="Custo acumulado" value={formatCurrency(projectSpent)} />
                      <SummaryRow label="Venda projetada" value={formatCurrency(projectSaleValue)} />
                      <SummaryRow label="Sócios" value={String(partners.length)} />
                      <SummaryRow label="Itens lançados" value={String(invoiceItems.length)} />
                    </div>
                  </div>
                </div>
              </section>

              <section className="glass-card h-full rounded-[36px] p-5 sm:p-6">
                <SectionHeader
                  title="Resumo rápido"
                  subtitle="Dados principais para decisão"
                  action="Atual"
                />

                <div className="mt-5 grid gap-3">
                  <MiniInsight
                    icon={<Receipt size={18} />}
                    title="Notas processadas"
                    value={String(invoices.length)}
                  />
                  <MiniInsight
                    icon={<ScanLine size={18} />}
                    title="Itens reconhecidos"
                    value={String(invoiceItems.length)}
                  />
                  <MiniInsight
                    icon={<TrendingUp size={18} />}
                    title="Centros cadastrados"
                    value={String(costCenters.length)}
                  />
                </div>
              </section>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.18fr_0.92fr]">
              <section className="glass-card h-full rounded-[36px] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="section-title">Centros de custo</h2>
                    <p className="section-subtitle mt-1">Orçamento x realizado por frente da obra</p>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <span className="text-sm font-medium text-[#2f7df6]">
                      {costCenters.length}/{COST_CENTER_LIMIT}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowAllCenters((prev) => !prev)}
                        className="text-sm font-medium text-[#2f7df6]"
                      >
                        {showAllCenters ? 'Mostrar menos' : 'Ver todos'}
                      </button>

                      <button
                        onClick={() => {
                          setEditingCostCenter(null)
                          setCostCenterModalOpen(true)
                        }}
                        className="soft-pill inline-flex items-center gap-2 rounded-[18px] px-4 py-2.5 text-sm font-semibold"
                      >
                        <Plus size={16} />
                        Novo centro de custo
                      </button>
                    </div>
                  </div>
                </div>

                {filteredCenters.length === 0 ? (
                  <div className="mt-5">
                    <EmptyCard text={centersEmptyText} />
                  </div>
                ) : showAllCenters ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredCenters.map((center) => {
                      const budget = Number(center.planned_budget ?? 0)
                      const spent = Number(center.spent ?? 0)
                      const percent = budget > 0 ? (spent / budget) * 100 : 0

                      return (
                        <div key={center.id} className="metric-card rounded-[28px] p-4">
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm text-[#5f7aa5]">{center.name}</p>
                              <h3 className="mt-1 text-[1rem] font-semibold tracking-[-0.03em] text-[#14213d] sm:text-[1.15rem]">
                                {formatCurrency(spent)}
                              </h3>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingCostCenter(center)
                                  setCostCenterModalOpen(true)
                                }}
                                className="soft-pill flex h-10 w-10 items-center justify-center rounded-[16px]"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteCostCenter(center.id)}
                                className="soft-pill flex h-10 w-10 items-center justify-center rounded-[16px]"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          <div className="mb-2 h-2.5 rounded-full bg-[#d7e6ff]">
                            <div
                              className="h-2.5 rounded-full bg-[#2f7df6]"
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                          </div>

                          <div className="mb-4 flex items-center justify-between text-sm text-[#6981a8]">
                            <span>Budget {formatCurrency(budget)}</span>
                            <span>{formatPercent(percent)}</span>
                          </div>

                          <div className="rounded-[18px] border border-dashed border-[rgba(47,125,246,0.18)] px-3 py-4 text-sm text-[#7991b5]">
                            Centro pronto para receber lançamentos e itens desta obra.
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="mt-5 w-full overflow-hidden">
                    <div className="w-full xl:max-w-[816px]">
                      <div className="horizontal-scrollbar w-full overflow-x-auto overflow-y-hidden pb-4">
                        <div className="flex min-w-max flex-nowrap gap-3">
                          {filteredCenters.map((center) => {
                            const budget = Number(center.planned_budget ?? 0)
                            const spent = Number(center.spent ?? 0)
                            const percent = budget > 0 ? (spent / budget) * 100 : 0

                            return (
                              <div
                                key={center.id}
                                className="metric-card w-[260px] min-w-[260px] max-w-[260px] shrink-0 rounded-[28px] p-4"
                              >
                                <div className="mb-4 flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm text-[#5f7aa5]">{center.name}</p>
                                    <h3 className="mt-1 text-[1rem] font-semibold tracking-[-0.03em] text-[#14213d] sm:text-[1.15rem]">
                                      {formatCurrency(spent)}
                                    </h3>
                                  </div>

                                  <div className="flex shrink-0 items-center gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingCostCenter(center)
                                        setCostCenterModalOpen(true)
                                      }}
                                      className="soft-pill flex h-10 w-10 items-center justify-center rounded-[16px]"
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteCostCenter(center.id)}
                                      className="soft-pill flex h-10 w-10 items-center justify-center rounded-[16px]"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </div>

                                <div className="mb-2 h-2.5 rounded-full bg-[#d7e6ff]">
                                  <div
                                    className="h-2.5 rounded-full bg-[#2f7df6]"
                                    style={{ width: `${Math.min(percent, 100)}%` }}
                                  />
                                </div>

                                <div className="mb-4 flex items-center justify-between text-sm text-[#6981a8]">
                                  <span>Budget {formatCurrency(budget)}</span>
                                  <span>{formatPercent(percent)}</span>
                                </div>

                                <div className="rounded-[18px] border border-dashed border-[rgba(47,125,246,0.18)] px-3 py-4 text-sm text-[#7991b5]">
                                  Centro pronto para receber lançamentos e itens desta obra.
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="glass-card h-full rounded-[36px] p-5 sm:p-6">
                <SectionHeader
                  title="Sócios da obra"
                  subtitle="Participação societária editável"
                  action={`${partners.length} sócios`}
                />

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      setEditingPartner(null)
                      setPartnerModalOpen(true)
                    }}
                    className="soft-pill inline-flex items-center gap-2 rounded-[18px] px-4 py-2.5 text-sm font-semibold"
                  >
                    <Plus size={16} />
                    Novo sócio
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {partners.map((partner) => (
                    <div
                      key={partner.id}
                      className="metric-card flex items-center justify-between rounded-[24px] px-4 py-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="soft-pill flex h-11 w-11 items-center justify-center rounded-[18px]">
                          <Users size={18} />
                        </div>

                        <div>
                          <p className="font-semibold text-[#14213d]">{partner.name}</p>
                          <p className="text-sm text-[#6f87ad]">Sócio da obra</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="soft-pill rounded-full px-3 py-1.5 text-sm font-semibold">
                          {partner.share_percent}%
                        </div>

                        <button
                          onClick={() => {
                            setEditingPartner(partner)
                            setPartnerModalOpen(true)
                          }}
                          className="soft-pill flex h-10 w-10 items-center justify-center rounded-[16px]"
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          onClick={() => handleDeletePartner(partner.id)}
                          className="soft-pill flex h-10 w-10 items-center justify-center rounded-[16px]"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {partners.length === 0 ? <EmptyCard text="Nenhum sócio cadastrado ainda." /> : null}
                </div>
              </section>
            </div>

            <section className="glass-card mt-6 rounded-[36px] p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="section-title">Notas fiscais</h2>
                  <p className="section-subtitle mt-1">Cadastro manual com edição e exclusão</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-[#2f7df6]">
                    {filteredInvoices.length} resultados
                  </span>

                  <button
                    onClick={() => setShowAllInvoices((prev) => !prev)}
                    className="text-sm font-medium text-[#2f7df6]"
                  >
                    {showAllInvoices ? 'Mostrar menos' : 'Ver tudo'}
                  </button>
                </div>
              </div>

              {searchTerm.trim() && filteredAggregatedItems.length > 0 ? (
                <div className="mt-5 rounded-[28px] border border-[rgba(47,125,246,0.12)] bg-[rgba(255,255,255,0.6)] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-[#14213d]">Resumo por item</h3>
                      <p className="text-sm text-[#6981a8]">
                        Resultado agregado da busca por item
                      </p>
                    </div>
                    <div className="soft-pill rounded-full px-3 py-1.5 text-sm font-semibold">
                      {filteredAggregatedItems.length} item(ns)
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {filteredAggregatedItems.map((item) => (
                      <div key={item.key} className="metric-card rounded-[22px] px-4 py-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-lg font-semibold text-[#14213d]">{item.name}</p>
                            <p className="mt-1 text-sm text-[#6981a8]">
                              Notas: {Array.from(item.invoiceNumbers).join(', ') || 'Sem notas'}
                            </p>
                            <p className="mt-1 text-sm text-[#6981a8]">
                              Centros: {Array.from(item.costCenterNames).join(', ') || 'Sem centro'}
                            </p>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-3">
                            <div className="rounded-[18px] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-center">
                              <p className="text-xs uppercase tracking-[0.08em] text-[#6981a8]">Quantidade</p>
                              <p className="mt-1 font-semibold text-[#14213d]">{item.totalQuantity}</p>
                            </div>
                            <div className="rounded-[18px] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-center">
                              <p className="text-xs uppercase tracking-[0.08em] text-[#6981a8]">Valor total</p>
                              <p className="mt-1 font-semibold text-[#14213d]">{formatCurrency(item.totalAmount)}</p>
                            </div>
                            <div className="rounded-[18px] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-center">
                              <p className="text-xs uppercase tracking-[0.08em] text-[#6981a8]">Notas</p>
                              <p className="mt-1 font-semibold text-[#14213d]">{item.invoiceIds.size}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 lg:grid-cols-5">
                <input
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value)
                    setSearchDraft(event.target.value)
                  }}
                  placeholder="Buscar por nota, item ou centro"
                  className="rounded-[18px] border border-[rgba(93,133,201,0.12)] bg-white/80 px-4 py-3 outline-none lg:col-span-2"
                />
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(event) => setFilterMonth(event.target.value)}
                  className="rounded-[18px] border border-[rgba(93,133,201,0.12)] bg-white/80 px-4 py-3 outline-none"
                />
                <select
                  value={filterCenterId}
                  onChange={(event) => setFilterCenterId(event.target.value)}
                  className="rounded-[18px] border border-[rgba(93,133,201,0.12)] bg-white/80 px-4 py-3 outline-none"
                >
                  <option value="">Todos os centros</option>
                  {costCenters.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-end">
                  <button
                    onClick={clearAllFilters}
                    className="text-sm font-medium text-[#2f7df6]"
                  >
                    Limpar filtros
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    setEditingInvoice(null)
                    setInvoiceModalOpen(true)
                  }}
                  className="soft-pill inline-flex items-center gap-2 rounded-[18px] px-4 py-2.5 text-sm font-semibold"
                >
                  <Plus size={16} />
                  Nova nota fiscal
                </button>
              </div>

              <div className="mt-5">
                <div className={`space-y-4 overflow-y-auto pr-1 ${showAllInvoices ? 'max-h-[700px]' : 'max-h-[430px]'}`}>
                  {visibleInvoices.map((invoice) => {
                    const items = invoiceItems.filter((item) => item.invoice_id === invoice.id)

                    return (
                      <div key={invoice.id} className="metric-card rounded-[30px] p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-3">
                            <div className="primary-card flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] text-white">
                              <Receipt size={20} />
                            </div>

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#14213d]">
                                  {invoice.invoice_number}
                                </h3>
                                {invoice.supplier ? (
                                  <span className="rounded-full bg-[rgba(47,125,246,0.1)] px-2.5 py-1 text-xs font-medium text-[#2f7df6]">
                                    {invoice.supplier}
                                  </span>
                                ) : null}
                              </div>

                              <p className="mt-1 text-sm text-[#6981a8]">
                                Emitida em {invoice.issue_date || 'Sem data'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="text-sm text-[#6981a8]">Total</p>
                              <p className="text-lg font-semibold text-[#14213d]">
                                {formatCurrency(Number(invoice.total_amount ?? 0))}
                              </p>
                            </div>

                            <button
                              onClick={() => {
                                setEditingInvoice(invoice)
                                setInvoiceModalOpen(true)
                              }}
                              className="soft-pill flex h-10 w-10 items-center justify-center rounded-[16px]"
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              onClick={() => handleDeleteInvoice(invoice.id)}
                              className="soft-pill flex h-10 w-10 items-center justify-center rounded-[16px]"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2.5">
                          {items.map((item) => {
                            const center = costCenters.find((costCenter) => costCenter.id === item.cost_center_id)

                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between rounded-[20px] bg-[rgba(255,255,255,0.68)] px-3.5 py-3"
                              >
                                <div>
                                  <p className="font-medium text-[#14213d]">{item.description}</p>
                                  <p className="text-sm text-[#6981a8]">
                                    Qtd {Number(item.quantity ?? 0)} • {center?.name ?? 'Centro não definido'}
                                  </p>
                                </div>

                                <div className="text-right font-semibold text-[#2f7df6]">
                                  {formatCurrency(Number(item.amount ?? 0))}
                                </div>
                              </div>
                            )
                          })}

                          {items.length === 0 ? <EmptyCard text="Sem itens nesta nota." /> : null}
                        </div>
                      </div>
                    )
                  })}

                  {visibleInvoices.length === 0 ? (
                    <EmptyCard text="Nenhuma nota fiscal encontrada com os filtros atuais." />
                  ) : null}
                </div>
              </div>
            </section>
          </>
        ) : null}

        <ProjectModal
          open={projectModalOpen}
          loading={appLoading}
          mode={editingProject ? 'edit' : 'create'}
          initialData={
            editingProject
              ? {
                  name: editingProject.name,
                  totalArea: Number(editingProject.total_area ?? 0),
                  startDate: editingProject.start_date || '',
                  status: editingProject.status,
                  estimatedSaleValue: Number(editingProject.estimated_sale_value ?? 0),
                }
              : null
          }
          projectCount={projects.length}
          onClose={() => {
            setProjectModalOpen(false)
            setEditingProject(null)
          }}
          onSubmit={(payload) => {
            if (editingProject) return handleUpdateProject(payload)
            return handleCreateProject(payload)
          }}
        />

        <PartnerModal
          open={partnerModalOpen}
          loading={appLoading}
          mode={editingPartner ? 'edit' : 'create'}
          initialData={
            editingPartner
              ? {
                  name: editingPartner.name,
                  sharePercent: Number(editingPartner.share_percent ?? 0),
                }
              : null
          }
          onClose={() => {
            setPartnerModalOpen(false)
            setEditingPartner(null)
          }}
          onSubmit={(payload) => {
            if (editingPartner) return handleUpdatePartner(payload)
            return handleCreatePartner(payload)
          }}
        />

        <CostCenterModal
          open={costCenterModalOpen}
          loading={appLoading}
          currentCount={costCenters.length}
          mode={editingCostCenter ? 'edit' : 'create'}
          initialData={
            editingCostCenter
              ? {
                  name: editingCostCenter.name,
                  category: editingCostCenter.category || '',
                  plannedBudget: Number(editingCostCenter.planned_budget ?? 0),
                }
              : null
          }
          onClose={() => {
            setCostCenterModalOpen(false)
            setEditingCostCenter(null)
          }}
          onSubmit={(payload) => {
            if (editingCostCenter) return handleUpdateCostCenter(payload)
            return handleCreateCostCenter(payload)
          }}
        />

        <InvoiceModal
          open={invoiceModalOpen}
          loading={appLoading}
          mode={editingInvoice ? 'edit' : 'create'}
          initialData={
            editingInvoice
              ? {
                  invoiceNumber: editingInvoice.invoice_number,
                  supplier: editingInvoice.supplier || '',
                  issueDate: editingInvoice.issue_date || '',
                  notes: editingInvoice.notes || '',
                  items:
                    invoiceItems
                      .filter((item) => item.invoice_id === editingInvoice.id)
                      .map((item) => ({
                        description: item.description,
                        quantity: Number(item.quantity ?? 1),
                        amount: Number(item.amount ?? 0),
                        costCenterId: item.cost_center_id || '',
                      })) || [],
                }
              : null
          }
          costCenters={costCenters}
          onClose={() => {
            setInvoiceModalOpen(false)
            setEditingInvoice(null)
          }}
          onSubmit={(payload) => {
            if (editingInvoice) return handleUpdateInvoice(payload)
            return handleCreateInvoice(payload)
          }}
        />

        <SearchOverlay
          open={searchOpen}
          searchTerm={searchDraft}
          onChange={setSearchDraft}
          onSearch={applySearchAndClose}
          onClear={() => {
            setSearchDraft('')
            setSearchTerm('')
          }}
          onKeyDown={handleSearchKeyDown}
          onClose={() => setSearchOpen(false)}
        />

        <NotificationsPanel
          open={notificationsOpen}
          notifications={notifications}
          onClose={() => setNotificationsOpen(false)}
        />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-4 pb-5 sm:hidden">
        <div className="mobile-bottom relative flex items-center justify-between rounded-[28px] px-6 py-4">
          <BottomItem icon={<Home size={20} />} active />
          <BottomItem icon={<WalletCards size={20} />} />
          <button className="primary-card absolute left-1/2 top-0 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white">
            <LayoutGrid size={22} />
          </button>
          <BottomItem icon={<PieChartIcon size={20} />} />
          <BottomItem icon={<Settings2 size={20} />} />
        </div>
      </nav>
    </main>
  )
}

function AuthScreen({
  onError,
  onSuccess,
}: {
  onError: (message: string | null) => void
  onSuccess: (message: string | null) => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    onError(null)
    onSuccess(null)

    if (mode === 'register') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) {
        onError(error.message)
        setLoading(false)
        return
      }

      if (data.session) {
        onSuccess('Conta criada e login realizado.')
      } else {
        onSuccess('Conta criada. Confirme o e-mail para entrar.')
      }

      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      onError(error.message)
      setLoading(false)
      return
    }

    onSuccess('Login realizado com sucesso.')
    setLoading(false)
  }

  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass-card w-full max-w-md rounded-[36px] p-6 sm:p-7">
        <div className="mb-6 text-center">
          <div className="primary-card mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] text-white">
            <HardHat size={28} />
          </div>
          <h1 className="text-[2rem] font-semibold tracking-[-0.05em] text-[#14213d]">
            RP OBRA TRACKER
          </h1>
          <p className="mt-2 text-sm text-[#6f87ad]">
            Entre para acessar suas obras e lançamentos.
          </p>
        </div>

        <div className="mb-5 flex rounded-[20px] bg-[rgba(47,125,246,0.08)] p-1">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 rounded-[16px] px-4 py-3 text-sm font-semibold ${
              mode === 'login' ? 'bg-white text-[#2f7df6]' : 'text-[#6f87ad]'
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 rounded-[16px] px-4 py-3 text-sm font-semibold ${
              mode === 'register' ? 'bg-white text-[#2f7df6]' : 'text-[#6f87ad]'
            }`}
          >
            Criar conta
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === 'register' ? (
            <Field
              label="Nome completo"
              value={fullName}
              onChange={setFullName}
              placeholder="Seu nome"
            />
          ) : null}

          <Field
            label="E-mail"
            value={email}
            onChange={setEmail}
            placeholder="voce@empresa.com"
            type="email"
          />

          <Field
            label="Senha"
            value={password}
            onChange={setPassword}
            placeholder="Sua senha"
            type="password"
          />

          <button
            type="submit"
            disabled={loading}
            className="primary-card mt-2 w-full rounded-[22px] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
      </div>
    </main>
  )
}

function ProjectModal({
  open,
  loading,
  mode,
  initialData,
  projectCount,
  onClose,
  onSubmit,
}: {
  open: boolean
  loading: boolean
  mode: 'create' | 'edit'
  initialData: ProjectPayload | null
  projectCount: number
  onClose: () => void
  onSubmit: (payload: ProjectPayload) => void
}) {
  const [name, setName] = useState('')
  const [totalArea, setTotalArea] = useState('')
  const [startDate, setStartDate] = useState('')
  const [status, setStatus] = useState('Inicial')
  const [estimatedSaleValue, setEstimatedSaleValue] = useState('')

  useEffect(() => {
    if (!open) return
    setName(initialData?.name ?? '')
    setTotalArea(initialData ? String(initialData.totalArea) : '')
    setStartDate(initialData?.startDate ?? '')
    setStatus(initialData?.status ?? 'Inicial')
    setEstimatedSaleValue(initialData ? String(initialData.estimatedSaleValue) : '')
  }, [open, initialData])

  if (!open) return null

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit({
      name,
      totalArea: numberValue(totalArea),
      startDate,
      status,
      estimatedSaleValue: numberValue(estimatedSaleValue),
    })
  }

  return (
    <ModalShell
      title={mode === 'create' ? (projectCount === 0 ? 'Cadastrar primeira obra' : 'Nova obra') : 'Editar obra'}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Nome da obra" value={name} onChange={setName} placeholder="Ex.: Vila Toscana" />
        <Field label="Área total (m²)" value={totalArea} onChange={setTotalArea} placeholder="100" />
        <Field label="Data de início" value={startDate} onChange={setStartDate} type="date" />
        <Field
          label="Valor estimado de venda"
          value={estimatedSaleValue}
          onChange={setEstimatedSaleValue}
          placeholder="360000"
        />

        <div>
          <label className="mb-2 block text-sm font-medium text-[#4a648d]">Status</label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-[18px] border border-[rgba(79,126,196,0.12)] bg-white/80 px-4 py-3 outline-none"
          >
            <option>Inicial</option>
            <option>Em andamento</option>
            <option>Concluído</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="primary-card w-full rounded-[22px] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? 'Salvando...' : mode === 'create' ? 'Salvar obra' : 'Atualizar obra'}
        </button>
      </form>
    </ModalShell>
  )
}

function PartnerModal({
  open,
  loading,
  mode,
  initialData,
  onClose,
  onSubmit,
}: {
  open: boolean
  loading: boolean
  mode: 'create' | 'edit'
  initialData: PartnerPayload | null
  onClose: () => void
  onSubmit: (payload: PartnerPayload) => void
}) {
  const [name, setName] = useState('')
  const [sharePercent, setSharePercent] = useState('')

  useEffect(() => {
    if (!open) return
    setName(initialData?.name ?? '')
    setSharePercent(initialData ? String(initialData.sharePercent) : '')
  }, [open, initialData])

  if (!open) return null

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit({
      name,
      sharePercent: numberValue(sharePercent),
    })
  }

  return (
    <ModalShell title={mode === 'create' ? 'Novo sócio' : 'Editar sócio'} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Nome" value={name} onChange={setName} placeholder="Nome do sócio" />
        <Field label="Participação (%)" value={sharePercent} onChange={setSharePercent} placeholder="50" />

        <button
          type="submit"
          disabled={loading}
          className="primary-card w-full rounded-[22px] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? 'Salvando...' : mode === 'create' ? 'Salvar sócio' : 'Atualizar sócio'}
        </button>
      </form>
    </ModalShell>
  )
}

function CostCenterModal({
  open,
  loading,
  currentCount,
  mode,
  initialData,
  onClose,
  onSubmit,
}: {
  open: boolean
  loading: boolean
  currentCount: number
  mode: 'create' | 'edit'
  initialData: CostCenterPayload | null
  onClose: () => void
  onSubmit: (payload: CostCenterPayload) => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [plannedBudget, setPlannedBudget] = useState('')

  useEffect(() => {
    if (!open) return
    setName(initialData?.name ?? '')
    setCategory(initialData?.category ?? '')
    setPlannedBudget(initialData ? String(initialData.plannedBudget) : '')
  }, [open, initialData])

  if (!open) return null

  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit({
      name,
      category,
      plannedBudget: numberValue(plannedBudget),
    })
  }

  return (
    <ModalShell title={mode === 'create' ? `Novo centro de custo (${currentCount}/${COST_CENTER_LIMIT})` : 'Editar centro de custo'} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Nome" value={name} onChange={setName} placeholder="Ex.: Estrutura" />
        <Field label="Categoria macro" value={category} onChange={setCategory} placeholder="Ex.: Materiais" />
        <Field
          label="Budget planejado"
          value={plannedBudget}
          onChange={setPlannedBudget}
          placeholder="15000"
        />

        <button
          type="submit"
          disabled={loading}
          className="primary-card w-full rounded-[22px] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? 'Salvando...' : mode === 'create' ? 'Salvar centro de custo' : 'Atualizar centro de custo'}
        </button>
      </form>
    </ModalShell>
  )
}

function InvoiceModal({
  open,
  loading,
  mode,
  initialData,
  costCenters,
  onClose,
  onSubmit,
}: {
  open: boolean
  loading: boolean
  mode: 'create' | 'edit'
  initialData: {
    invoiceNumber: string
    supplier: string
    issueDate: string
    notes: string
    items: InvoiceItemPayload[]
  } | null
  costCenters: CostCenter[]
  onClose: () => void
  onSubmit: (payload: InvoicePayload) => void
}) {
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [supplier, setSupplier] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<InvoiceItemPayload[]>([createEmptyInvoiceItemPayload()])

  useEffect(() => {
    if (!open) return

    setInvoiceNumber(initialData?.invoiceNumber ?? '')
    setSupplier(initialData?.supplier ?? '')
    setIssueDate(initialData?.issueDate ?? '')
    setNotes(initialData?.notes ?? '')
    setItems(
      initialData?.items && initialData.items.length > 0
        ? initialData.items
        : [createEmptyInvoiceItemPayload()],
    )
  }, [open, initialData])

  const totalAmount = items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)

  if (!open) return null

  function updateItem(index: number, patch: Partial<InvoiceItemPayload>) {
    setItems((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        return { ...item, ...patch }
      }),
    )
  }

  function addItem() {
    setItems((prev) => [...prev, createEmptyInvoiceItemPayload()])
  }

  function removeItem(index: number) {
    setItems((prev) => {
      if (prev.length === 1) return prev
      return prev.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  function submit(event: FormEvent) {
    event.preventDefault()

    onSubmit({
      invoiceNumber,
      supplier,
      issueDate,
      notes,
      items,
    })
  }

  return (
    <ModalShell title={mode === 'create' ? 'Nova nota fiscal' : 'Editar nota fiscal'} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Número da nota" value={invoiceNumber} onChange={setInvoiceNumber} placeholder="NF 001" />
        <Field label="Fornecedor" value={supplier} onChange={setSupplier} placeholder="Fornecedor" />
        <Field label="Data de emissão" value={issueDate} onChange={setIssueDate} type="date" />

        <div className="rounded-[24px] border border-[rgba(79,126,196,0.12)] bg-white/50 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#14213d]">Itens da nota</h3>
              <p className="text-sm text-[#6f87ad]">Cadastre um ou mais itens com quantidade, valor e centro</p>
            </div>

            <button
              type="button"
              onClick={addItem}
              className="soft-pill inline-flex items-center gap-2 rounded-[16px] px-4 py-2 text-sm font-semibold"
            >
              <Plus size={16} />
              Adicionar item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="rounded-[20px] border border-[rgba(79,126,196,0.12)] bg-white/70 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#14213d]">Item {index + 1}</p>

                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                    className="soft-pill inline-flex items-center gap-2 rounded-[14px] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    Remover
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Field
                    label="Descrição do item"
                    value={item.description}
                    onChange={(value) => updateItem(index, { description: value })}
                    placeholder="Ex.: Tijolo"
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Quantidade"
                      value={String(item.quantity || '')}
                      onChange={(value) => updateItem(index, { quantity: numberValue(value) })}
                      placeholder="10"
                    />
                    <Field
                      label="Valor do item"
                      value={String(item.amount || '')}
                      onChange={(value) => updateItem(index, { amount: numberValue(value) })}
                      placeholder="250"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="mb-2 block text-sm font-medium text-[#4a648d]">Centro de custo</label>
                  <select
                    value={item.costCenterId}
                    onChange={(event) => updateItem(index, { costCenterId: event.target.value })}
                    className="w-full rounded-[18px] border border-[rgba(79,126,196,0.12)] bg-white/80 px-4 py-3 outline-none"
                  >
                    <option value="">Selecione</option>
                    {costCenters.map((center) => (
                      <option key={center.id} value={center.id}>
                        {center.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-[18px] bg-[rgba(47,125,246,0.08)] px-4 py-3">
            <span className="text-sm font-medium text-[#4a648d]">Total calculado da nota</span>
            <span className="text-base font-semibold text-[#14213d]">{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[#4a648d]">Observações</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="w-full rounded-[18px] border border-[rgba(79,126,196,0.12)] bg-white/80 px-4 py-3 outline-none"
            placeholder="Observações da nota"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="primary-card w-full rounded-[22px] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? 'Salvando...' : mode === 'create' ? 'Salvar nota fiscal' : 'Atualizar nota fiscal'}
        </button>
      </form>
    </ModalShell>
  )
}

function SearchOverlay({
  open,
  searchTerm,
  onChange,
  onSearch,
  onClear,
  onKeyDown,
  onClose,
}: {
  open: boolean
  searchTerm: string
  onChange: (value: string) => void
  onSearch: () => void
  onClear: () => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 py-10">
      <div className="glass-card w-full max-w-2xl rounded-[32px] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#14213d]">Pesquisa rápida</h2>
          <button onClick={onClose} className="soft-pill flex h-10 w-10 items-center justify-center rounded-[16px]">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6e88ad]" size={18} />
            <input
              autoFocus
              value={searchTerm}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Buscar por nota, item ou centro de custo"
              className="w-full rounded-[20px] border border-[rgba(79,126,196,0.12)] bg-white/85 px-12 py-4 outline-none"
            />
          </div>

          <button
            onClick={onSearch}
            className="primary-card inline-flex items-center justify-center gap-2 rounded-[20px] px-5 py-4 text-sm font-semibold text-white"
          >
            <Search size={16} />
            Pesquisar
          </button>

          <button
            onClick={onClear}
            className="soft-pill inline-flex items-center justify-center gap-2 rounded-[20px] px-5 py-4 text-sm font-semibold"
          >
            Limpar
          </button>
        </div>
      </div>
    </div>
  )
}

function NotificationsPanel({
  open,
  notifications,
  onClose,
}: {
  open: boolean
  notifications: { id: string; text: string; date: string }[]
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 px-4 py-6">
      <div className="glass-card w-full max-w-md rounded-[32px] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#14213d]">Notificações</h2>
          <button onClick={onClose} className="soft-pill flex h-10 w-10 items-center justify-center rounded-[16px]">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          {notifications.map((item) => (
            <div key={item.id} className="metric-card rounded-[22px] px-4 py-4">
              <p className="font-medium text-[#14213d]">{item.text}</p>
              <p className="mt-1 text-sm text-[#6f87ad]">{item.date}</p>
            </div>
          ))}

          {notifications.length === 0 ? <EmptyCard text="Nenhuma notificação por enquanto." /> : null}
        </div>
      </div>
    </div>
  )
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
      <div className="glass-card max-h-[92vh] w-full max-w-3xl overflow-auto rounded-[32px] p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[#14213d]">{title}</h2>
          <button onClick={onClose} className="soft-pill rounded-[16px] px-4 py-2 text-sm font-semibold">
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function LoadingScreen({ text }: { text: string }) {
  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-4">
      <div className="glass-card rounded-[28px] px-6 py-5 text-center text-[#14213d]">
        {text}
      </div>
    </main>
  )
}

function MessageBanner({
  type,
  message,
}: {
  type: 'error' | 'success'
  message: string
}) {
  return (
    <div
      className={`mb-4 rounded-[20px] px-4 py-3 text-sm font-medium ${
        type === 'error'
          ? 'bg-red-100 text-red-700'
          : 'bg-emerald-100 text-emerald-700'
      }`}
    >
      {message}
    </div>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[rgba(79,126,196,0.18)] bg-white/40 px-4 py-6 text-center text-sm text-[#7890b5]">
      {text}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[#4a648d]">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        className="w-full rounded-[18px] border border-[rgba(79,126,196,0.12)] bg-white/80 px-4 py-3 outline-none"
      />
    </div>
  )
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle: string
  action: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="section-title">{title}</h2>
        <p className="section-subtitle mt-1">{subtitle}</p>
      </div>

      <button className="text-sm font-medium text-[#2f7df6]">{action}</button>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  highlight = false,
}: {
  title: string
  value: string
  icon: ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={`min-w-0 rounded-[28px] p-4 ${
        highlight ? 'primary-card text-white' : 'metric-card text-[#14213d]'
      }`}
    >
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className={`text-sm ${highlight ? 'text-white/75' : 'text-[#6580a9]'}`}>
            {title}
          </p>

          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] ${
              highlight ? 'bg-white/14 text-white' : 'soft-pill'
            }`}
          >
            {icon}
          </div>
        </div>

        <div className="min-w-0">
          <h3 className="min-w-0 break-words text-[1.15rem] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[1.3rem]">
            {value}
          </h3>
        </div>
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between rounded-[22px] bg-[rgba(255,255,255,0.68)] px-4 py-3">
      <span className="text-sm text-[#6981a8]">{label}</span>
      <span className="text-sm font-semibold text-[#14213d] sm:text-base">{value}</span>
    </div>
  )
}

function MiniInsight({
  icon,
  title,
  value,
}: {
  icon: ReactNode
  title: string
  value: string
}) {
  return (
    <div className="metric-card flex items-center justify-between rounded-[24px] px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="soft-pill flex h-11 w-11 items-center justify-center rounded-[18px]">
          {icon}
        </div>

        <div>
          <p className="font-semibold text-[#14213d]">{title}</p>
          <p className="text-sm text-[#6f87ad]">Resumo rápido</p>
        </div>
      </div>

      <div className="text-base font-semibold text-[#14213d] sm:text-lg">{value}</div>
    </div>
  )
}

function InfoBadge({
  icon,
  label,
}: {
  icon: ReactNode
  label: string
}) {
  return (
    <div className="soft-pill inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium">
      {icon}
      {label}
    </div>
  )
}

function BottomItem({
  icon,
  active = false,
}: {
  icon: ReactNode
  active?: boolean
}) {
  return <button className={active ? 'text-[#2f7df6]' : 'text-[#264874]'}>{icon}</button>
}

export default App