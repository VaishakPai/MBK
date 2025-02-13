import React, { useState, ChangeEvent } from 'react';
import { Upload, Filter, Table as TableIcon } from 'lucide-react';

interface FormData {
  pdf1: File | null;
  pdf2: File | null;
  sections: {
    A: { number: string; date: string };
    B: { number: string; date: string };
    S: { number: string; date: string };
  };
}

interface TableData {
  id: number;
  section: string;
  number: string;
  date: string;
  pdf1: string;
  pdf2: string;
  status: 'processing' | 'completed' | 'error';
  result?: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<'form' | 'table'>('form');
  const [filterSection, setFilterSection] = useState<'all' | 'A' | 'B' | 'S'>('all');
  const [tableData, setTableData] = useState<TableData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    pdf1: null,
    pdf2: null,
    sections: {
      A: { number: '', date: '' },
      B: { number: '', date: '' },
      S: { number: '', date: '' }
    }
  });

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>, field: 'pdf1' | 'pdf2') => {
    const file = event.target.files?.[0] || null;
    if (file && file.type === 'application/pdf') {
      setFormData(prev => ({ ...prev, [field]: file }));
    }
  };

  const handleInputChange = (
    section: 'A' | 'B' | 'S',
    field: 'number' | 'date',
    value: string
  ) => {
    setFormData(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [section]: {
          ...prev.sections[section],
          [field]: value
        }
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form data
    if (!formData.pdf1 || !formData.pdf2) {
      alert('Please upload both PDF files');
      return;
    }

    const hasEmptyFields = Object.values(formData.sections).some(
      section => !section.number || !section.date
    );

    if (hasEmptyFields) {
      alert('Please fill in all section numbers and dates');
      return;
    }

    setIsProcessing(true);

    try {
      // Create entries for the table with initial processing status
      const newEntries: TableData[] = Object.entries(formData.sections).map(([section, data], index) => ({
        id: Date.now() + index,
        section,
        number: data.number,
        date: data.date,
        pdf1: formData.pdf1?.name || 'No file',
        pdf2: formData.pdf2?.name || 'No file',
        status: 'processing'
      }));
      
      setTableData(prev => [...prev, ...newEntries]);
      setActiveTab('table');

      // Prepare form data for the backend
      const formDataToSend = new FormData();
      formDataToSend.append('pdf1', formData.pdf1);
      formDataToSend.append('pdf2', formData.pdf2);
      formDataToSend.append('sections', JSON.stringify(formData.sections));

      // Send to Python backend
      const response = await fetch('http://localhost:8000/process-pdfs', {
        method: 'POST',
        body: formDataToSend,
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // Update table entries with results
      setTableData(prev => 
        prev.map(entry => {
          const isNewEntry = newEntries.some(newEntry => newEntry.id === entry.id);
          if (isNewEntry) {
            return {
              ...entry,
              status: 'completed',
              result: result[entry.section]?.result || 'Processing complete'
            };
          }
          return entry;
        })
      );
    } catch (error) {
      console.error('Error processing PDFs:', error);
      // Update table entries with error status
      setTableData(prev =>
        prev.map(entry => ({
          ...entry,
          status: entry.status === 'processing' ? 'error' : entry.status,
          result: entry.status === 'processing' ? 'Error processing PDF' : entry.result
        }))
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredData = filterSection === 'all' 
    ? tableData 
    : tableData.filter(item => item.section === filterSection);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Menu Bar */}
      <div className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setActiveTab('form')}
                className={`px-4 py-2 rounded-md ${
                  activeTab === 'form'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Upload className="w-4 h-4" />
                  <span>Form</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('table')}
                className={`px-4 py-2 rounded-md ${
                  activeTab === 'table'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <TableIcon className="w-4 h-4" />
                  <span>View Data</span>
                </div>
              </button>
            </div>
            {activeTab === 'table' && (
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={filterSection}
                  onChange={(e) => setFilterSection(e.target.value as 'all' | 'A' | 'B' | 'S')}
                  className="border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">All Sections</option>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="S">Section S</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {activeTab === 'form' ? (
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h1 className="text-3xl font-bold text-gray-900 text-center mb-8">
                Document Processing Form
              </h1>

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* PDF File Inputs */}
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">PDF Documents</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {['pdf1', 'pdf2'].map((pdf, index) => (
                      <div key={pdf} className="relative">
                        <label
                          className="block p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 transition-colors cursor-pointer group"
                        >
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => handleFileChange(e, pdf as 'pdf1' | 'pdf2')}
                            className="hidden"
                          />
                          <div className="flex flex-col items-center">
                            <Upload className="w-8 h-8 text-gray-400 group-hover:text-indigo-500 mb-2" />
                            <span className="text-sm font-medium text-gray-700">
                              {formData[pdf as 'pdf1' | 'pdf2']
                                ? formData[pdf as 'pdf1' | 'pdf2']?.name
                                : `Upload PDF ${index + 1}`}
                            </span>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section Inputs */}
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Section Details</h2>
                  {(['A', 'B', 'S'] as const).map((section) => (
                    <div key={section} className="bg-gray-50 p-6 rounded-lg">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Section {section}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            4-Digit Number
                          </label>
                          <input
                            type="text"
                            pattern="[0-9]{4}"
                            maxLength={4}
                            value={formData.sections[section].number}
                            onChange={(e) => handleInputChange(section, 'number', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Enter 4 digits"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Date
                          </label>
                          <input
                            type="date"
                            value={formData.sections[section].date}
                            onChange={(e) => handleInputChange(section, 'date', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`w-full py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors ${
                    isProcessing
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {isProcessing ? 'Processing...' : 'Submit Form'}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Submitted Data</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Section</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PDF 1</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PDF 2</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredData.map((item) => (
                        <tr key={item.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.section}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.date}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.pdf1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.pdf2}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              item.status === 'completed' ? 'bg-green-100 text-green-800' :
                              item.status === 'error' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.result || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;