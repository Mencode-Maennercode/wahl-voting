"use client"

import { useState, useCallback } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'

interface TemplateEditorProps {
  initialContent?: string
  onChange: (content: string) => void
  placeholder?: string
}

export default function TemplateEditor({ 
  initialContent = '', 
  onChange, 
  placeholder = "Gestalten Sie hier Ihren Stimmzettel..." 
}: TemplateEditorProps) {
  const [content, setContent] = useState(initialContent)

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'font': [] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      ['link', 'image'],
      ['clean']
    ],
  }

  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'align',
    'list', 'bullet', 'indent',
    'link', 'image'
  ]

  const handleChange = useCallback((value: string) => {
    setContent(value)
    onChange(value)
  }, [onChange])

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Stimmzettel-Editor</label>
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <ReactQuill
          theme="snow"
          value={content}
          onChange={handleChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          style={{ height: '300px' }}
        />
      </div>
      <div className="text-xs text-slate-500">
        <p>• Verwenden Sie die Toolbar oben zum Formatieren Ihres Textes</p>
        <p>• Fügen Sie Bilder, Links und formatierten Text ein</p>
        <p>• Die Änderungen werden in der Vorschau rechts angezeigt</p>
      </div>
    </div>
  )
}
