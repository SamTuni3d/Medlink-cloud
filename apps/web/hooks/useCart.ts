'use client'

import { useReducer, useCallback } from 'react'
import type { CartItem } from '@/lib/pos/completeSale'

interface CartState {
  items: CartItem[]
}

type CartAction =
  | { type: 'ADD_ITEM'; item: CartItem }
  | { type: 'REMOVE_ITEM'; medicationId: string }
  | { type: 'UPDATE_QTY'; medicationId: string; quantity: number }
  | { type: 'CLEAR' }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.findIndex(
        i => i.medicationId === action.item.medicationId
      )
      if (existing >= 0) {
        // Increment quantity if already in cart
        return {
          items: state.items.map((item, idx) =>
            idx === existing
              ? { ...item, quantity: item.quantity + action.item.quantity }
              : item
          ),
        }
      }
      return { items: [...state.items, action.item] }
    }
    case 'REMOVE_ITEM':
      return {
        items: state.items.filter(i => i.medicationId !== action.medicationId),
      }
    case 'UPDATE_QTY': {
      if (action.quantity <= 0) {
        return {
          items: state.items.filter(i => i.medicationId !== action.medicationId),
        }
      }
      return {
        items: state.items.map(item =>
          item.medicationId === action.medicationId
            ? { ...item, quantity: action.quantity }
            : item
        ),
      }
    }
    case 'CLEAR':
      return { items: [] }
    default:
      return state
  }
}

function calcTotals(items: CartItem[]) {
  const subtotal = items.reduce(
    (sum, item) =>
      sum + Math.round(item.unitPrice * item.quantity * (1 - item.discountPercent / 100) * 100) / 100,
    0
  )
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    total: Math.round(subtotal * 100) / 100,
  }
}

export function useCart() {
  const [state, dispatch] = useReducer(cartReducer, { items: [] })

  const addItem = useCallback((item: CartItem) => {
    dispatch({ type: 'ADD_ITEM', item })
  }, [])

  const removeItem = useCallback((medicationId: string) => {
    dispatch({ type: 'REMOVE_ITEM', medicationId })
  }, [])

  const updateQty = useCallback((medicationId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QTY', medicationId, quantity })
  }, [])

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR' })
  }, [])

  const totals = calcTotals(state.items)

  return { items: state.items, totals, addItem, removeItem, updateQty, clearCart }
}
