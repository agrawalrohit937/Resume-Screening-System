import { useEffect, useState } from 'react';
import applyAssistantApi from '../../services/applyAssistantApi';

// NOTE: reuse an existing table/list component/styling if one is already
// established elsewhere (e.g. Results.jsx) - built standalone here only
// because the data shape (company/role/status) doesn't map cleanly onto
// what those tables likely render.

const STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-700',
  ready_for_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-blue-100 text-blue-700',
  sending: 'bg-amber-100 text-amber-700',
  sent: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

export default function ApplicationHistoryTable() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    applyAssistantApi
      .getHistory()
      .then((data) => {
        const raw = data?.items || (Array.isArray(data) ? data : []);
        setItems(Array.isArray(raw) ? raw : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load history:', err);
        setItems([]);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Loading application history...</p>;
  if (items.length === 0) return <p className="text-sm text-gray-500">No applications sent yet.</p>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b border-gray-200">
          <th className="py-2 pr-4">Company</th>
          <th className="py-2 pr-4">Role</th>
          <th className="py-2 pr-4">Status</th>
          <th className="py-2">Date</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.application_id} className="border-b border-gray-100">
            <td className="py-2 pr-4">{item.company_name}</td>
            <td className="py-2 pr-4">{item.job_title}</td>
            <td className="py-2 pr-4">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  STATUS_STYLES[item.status] || 'bg-gray-100 text-gray-700'
                }`}
              >
                {item.status.replace(/_/g, ' ')}
              </span>
            </td>
            <td className="py-2">{new Date(item.created_at).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
