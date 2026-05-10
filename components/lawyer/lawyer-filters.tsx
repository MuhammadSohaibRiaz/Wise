"use client"

import { useEffect, useState } from "react"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const SPECIALIZATIONS = [
  "Family Law",
  "Criminal Law",
  "Corporate Law",
  "Civil Law",
  "Intellectual Property",
  "Tax Law",
  "Real Estate Law",
  "Labor Law",
  "Immigration Law",
  "Bankruptcy Law",
]

const AVAILABILITY = [
  { value: "available", label: "Available Now" },
  { value: "busy", label: "Busy" },
  { value: "online", label: "Online Only" },
]

interface LawyerFiltersProps {
  onFilterChange: (filters: FilterState) => void
  isLoading?: boolean
  /** Hydrate from URL / parent (e.g. /match?specialization=Family+Law&location=Lahore) */
  initialFilters?: Partial<FilterState>
}

export interface FilterState {
  search: string
  specializations: string[]
  minRating: number
  maxRate: number
  availability: string | null
  location: string
}

export function LawyerFilters({ onFilterChange, isLoading, initialFilters }: LawyerFiltersProps) {
  const [filters, setFilters] = useState<FilterState>(() => ({
    search: initialFilters?.search ?? "",
    specializations: initialFilters?.specializations ?? [],
    minRating: initialFilters?.minRating ?? 0,
    maxRate: initialFilters?.maxRate ?? 500,
    availability: initialFilters?.availability ?? null,
    location: initialFilters?.location ?? "",
  }))

  // Push initial filter state (from URL etc.) up so the results grid applies them on first paint.
  useEffect(() => {
    onFilterChange(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once with initialized state
  }, [])

  const handleSearchChange = (value: string) => {
    const newFilters = { ...filters, search: value }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const toggleSpecialization = (spec: string) => {
    const newSpecs = filters.specializations.includes(spec)
      ? filters.specializations.filter((s) => s !== spec)
      : [...filters.specializations, spec]

    const newFilters = { ...filters, specializations: newSpecs }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleRatingChange = (value: string) => {
    const newFilters = { ...filters, minRating: Number.parseFloat(value) || 0 }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleRateChange = (value: string) => {
    const newFilters = { ...filters, maxRate: Number.parseFloat(value) || 500 }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleAvailabilityChange = (value: string) => {
    const newFilters = { ...filters, availability: value === filters.availability ? null : value }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleLocationChange = (value: string) => {
    const newFilters = { ...filters, location: value }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const resetFilters = () => {
    const emptyFilters: FilterState = {
      search: "",
      specializations: [],
      minRating: 0,
      maxRate: 500,
      availability: null,
      location: "",
    }
    setFilters(emptyFilters)
    onFilterChange(emptyFilters)
  }

  const activeFilterCount =
    (filters.search ? 1 : 0) +
    filters.specializations.length +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.maxRate < 500 ? 1 : 0) +
    (filters.availability ? 1 : 0) +
    (filters.location ? 1 : 0)

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Filters</h2>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={resetFilters} disabled={isLoading} className="text-xs">
            <X className="h-3 w-3 mr-1" />
            Reset ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name or expertise"
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            disabled={isLoading}
            className="pl-10"
          />
        </div>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Location</label>
        <Input
          type="text"
          placeholder="City or Online"
          value={filters.location}
          onChange={(e) => handleLocationChange(e.target.value)}
          disabled={isLoading}
        />
      </div>

      {/* Specializations */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Specializations</label>
        <div className="grid grid-cols-1 gap-2">
          {SPECIALIZATIONS.map((spec) => (
            <label
              key={spec}
              className="flex items-center gap-3 cursor-pointer rounded px-2 py-2 hover:bg-muted transition-colors"
            >
              <input
                type="checkbox"
                checked={filters.specializations.includes(spec)}
                onChange={() => toggleSpecialization(spec)}
                disabled={isLoading}
                className="h-4 w-4 rounded"
              />
              <span className="text-sm">{spec}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Minimum Rating */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Minimum Rating</label>
        <select
          value={filters.minRating}
          onChange={(e) => handleRatingChange(e.target.value)}
          disabled={isLoading}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="0">All ratings</option>
          <option value="3">3+ stars</option>
          <option value="4">4+ stars</option>
          <option value="4.5">4.5+ stars</option>
          <option value="5">5 stars</option>
        </select>
      </div>

      {/* Max Hourly Rate */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Max Hourly Rate</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="50"
            max="500"
            step="50"
            value={filters.maxRate}
            onChange={(e) => handleRateChange(e.target.value)}
            disabled={isLoading}
            className="flex-1"
          />
          <span className="text-sm font-semibold w-20 text-right">${filters.maxRate}</span>
        </div>
      </div>

      {/* Availability */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Availability</label>
        <div className="grid grid-cols-1 gap-2">
          {AVAILABILITY.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleAvailabilityChange(opt.value)}
              disabled={isLoading}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                filters.availability === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-muted/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
