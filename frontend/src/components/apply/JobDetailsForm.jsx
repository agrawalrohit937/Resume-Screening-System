import { useState } from 'react';

export default function JobDetailsForm({ onSubmit, isSubmitting }) {
  const [values, setValues] = useState({
    company_name: '',
    job_title: '',
    hr_email: '',
    job_description: '',
  });

  const handleChange = (field) => (e) => setValues((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
        <input
          type="text"
          required
          value={values.company_name}
          onChange={handleChange('company_name')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
        <input
          type="text"
          required
          value={values.job_title}
          onChange={handleChange('job_title')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">HR Email</label>
        <input
          type="email"
          required
          value={values.hr_email}
          onChange={handleChange('hr_email')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Job Description</label>
        <textarea
          required
          rows={8}
          value={values.job_description}
          onChange={handleChange('job_description')}
          placeholder="Paste the full job description here..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition"
      >
        {isSubmitting ? 'Generating...' : 'Generate Draft'}
      </button>
    </form>
  );
}
