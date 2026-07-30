import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HouseholdLedger from './App';

// Household Ledger never talks to Sheets directly — every read/write is a POST
// to the n8n webhook. Mock fetch by inspecting the requested action, mirroring
// the shape the real workflow returns (see Household_Ledger_List_Budget_Webhook_Agent.json).
function mockWebhook() {
  globalThis.fetch = vi.fn((_url, options) => {
    const body = JSON.parse(options.body);
    if (body.action === 'get') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ list: [], budget: 200, cadence: 'Week' }),
      });
    }
    if (body.action === 'upsert') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            list: [
              {
                item: body.item,
                category: body.category,
                store: body.store,
                price: body.price,
                qty: body.qty,
              },
            ],
            budget: 200,
            cadence: body.cadence,
          }),
      });
    }
    return Promise.reject(new Error(`Unexpected webhook action in test: ${body.action}`));
  });
}

describe('HouseholdLedger', () => {
  beforeEach(() => {
    mockWebhook();
  });

  it('adds a catalog item to the list and updates the subtotal', async () => {
    const user = userEvent.setup();
    render(<HouseholdLedger />);

    await waitFor(() =>
      expect(screen.getByText(/add items from the catalog/i)).toBeInTheDocument()
    );

    // Produce is the first category, so it's expanded by default.
    await user.click(screen.getByRole('button', { name: /watermelon/i }));

    await waitFor(() => expect(screen.getAllByText('Watermelon').length).toBeGreaterThan(1));
    expect(screen.getByText('Subtotal').closest('div')).toHaveTextContent('$6.99');
  });
});
