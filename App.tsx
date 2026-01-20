import React, { useState, useEffect, useRef } from 'react';
import { InternshipExperience, Message, AppView, Resume } from './types';
import { PhoneIcon, SendIcon, PlusIcon, DropdownIcon, MenuIcon, DotsIcon, CircleIcon, ChevronLeftIcon } from './components/Icons';
import { chatWithAI, structureExperience, translateResumeContent } from './services/geminiService';
import ExperienceCard from './components/ExperienceCard';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [selectedResume, setSelectedResume] = useState<Resume | null>(null);
  const [translatedResume, setTranslatedResume] = useState<Resume | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [editingExperience, setEditingExperience] = useState<InternshipExperience | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('极简通用风格');
  const [previewLanguage, setPreviewLanguage] = useState<'CH' | 'EN'>('CH');
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '你好！我是你的专属职业顾问“职引”。😊\n\n为了帮您打造一份出色的简历，请先告诉我您最近的一段实习或工作经历吧。比如在哪家公司担任什么职位？'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const [dynamicPrompts, setDynamicPrompts] = useState<string[]>(['分享字节跳动实习', '分享项目经历', '如何优化描述']);

  const [experiences, setExperiences] = useState<InternshipExperience[]>([
    { 
      id: 'e1', 
      company: '字节跳动', 
      position: 'AI产品经理', 
      duration: '2024.01 - 至今', 
      description: ['负责撰写PRD文档，为项目研发提供清晰、准确的需求指导', '跟进研发过程，及时协调解决问题，保障项目顺利推进'], 
      status: 'pending', 
      category: '工作' 
    }
  ]);
  const [deletedExperiences, setDeletedExperiences] = useState<InternshipExperience[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  // This ref is used for DOM-based exports (PDF and Image)
  const resumeRef = useRef<HTMLDivElement>(null);

  const templates = [
    { id: 'minimal', name: '极简通用风格', color: 'bg-indigo-500', font: 'font-serif', layout: 'classic' },
    { id: 'morandi', name: '莫兰迪风格', color: 'bg-emerald-500', font: 'font-sans', layout: 'sidebar' },
    { id: 'luxury', name: '轻奢线条风格', color: 'bg-amber-500', font: 'font-serif', layout: 'split' },
    { id: 'elite', name: '简约精英风格', color: 'bg-slate-700', font: 'font-sans', layout: 'modern' },
  ];

  const resumeHistory: Resume[] = [
    { 
      id: '1', 
      title: '字节跳动-产品经理校招简历', 
      date: '2024-05-20', 
      status: '已导出',
      sections: [
        {
          title: '工作经历',
          experiences: [experiences[0]]
        }
      ]
    }
  ];

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'zh-CN';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error("Speech recognition error:", err);
      }
    }
  };

  useEffect(() => {
    if (scrollRef.current && (currentView === 'chat')) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isTyping, currentView]);

  const handleSendMessage = async (text?: string) => {
    const content = text || inputValue;
    if (!content.trim()) return;

    if (currentView !== 'chat') {
      setCurrentView('chat');
    }

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: content };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const history = messages
        .filter(m => !m.isStructured)
        .map(m => ({
          role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
          parts: [{ text: m.content }]
        }));

      if (content === '✨ 立即生成卡片') {
        const fullContext = messages.map(m => m.content).join('\n');
        const structured = await structureExperience(fullContext);
        if (structured) {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '为您整理好了，请确认是否保存到资料库：',
            isStructured: true,
            structuredData: structured
          }]);
          setDynamicPrompts(['保存并返回资料库', '再修改一下']);
          setIsTyping(false);
          return;
        }
      }

      const aiResponse = await chatWithAI(content, history);
      let cleanResponse = aiResponse || '抱歉，我现在无法处理您的请求。';
      
      const isReady = cleanResponse.includes('[READY_TO_STRUCTURE]');
      if (isReady) {
        cleanResponse = cleanResponse.replace('[READY_TO_STRUCTURE]', '').trim();
        setDynamicPrompts(['✨ 立即生成卡片', '我想补充更多内容']);
      } else {
        setDynamicPrompts(['补充职责细节', '说说我的成就', '换个经历谈谈']);
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: cleanResponse
      }]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  const handleExportPDF = async () => {
    if (!resumeRef.current) {
        alert("无法找到简历内容，请尝试在预览页面导出。");
        return;
    }
    setIsExporting(true);
    const element = resumeRef.current;
    const fileName = selectedResume ? `${selectedResume.title}.pdf` : 'resume.pdf';
    
    const opt = {
      margin: 0,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      // @ts-ignore
      await window.html2pdf().from(element).set(opt).save();
    } catch (e) { 
      console.error("PDF Export Error:", e); 
      alert("PDF 导出失败，请重试。");
    } finally { 
      setIsExporting(false); 
      setShowExportMenu(false); 
    }
  };

  const handleExportImage = async () => {
    if (!resumeRef.current) {
        alert("无法找到简历内容，请尝试在预览页面导出。");
        return;
    }
    setIsExporting(true);
    try {
      // @ts-ignore
      const canvas = await window.html2canvas(resumeRef.current, { 
          scale: 2, 
          useCORS: true,
          backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = selectedResume ? `${selectedResume.title}.png` : 'resume.png';
      link.href = imgData;
      link.click();
    } catch (e) { 
      console.error("Image Export Error:", e); 
      alert("图片导出失败，请重试。");
    } finally { 
      setIsExporting(false); 
      setShowExportMenu(false); 
    }
  };

  const handleExportWord = async () => {
    const data = previewLanguage === 'EN' ? (translatedResume || selectedResume) : selectedResume;
    if (!data) return;
    setIsExporting(true);
    try {
      // @ts-ignore - The library is attached to global scope as 'docx'
      const docxLib = (window as any).docx;
      if (!docxLib) throw new Error("Docx library not loaded");

      const { Document, Packer, Paragraph, TextRun, AlignmentType } = docxLib;
      
      const children: any[] = [];

      // Add Document Title
      children.push(new Paragraph({
        children: [new TextRun({ text: data.title, bold: true, size: 36 })],
        alignment: AlignmentType ? AlignmentType.CENTER : "center",
        spacing: { after: 200 }
      }));

      // Add Update Date
      children.push(new Paragraph({
        children: [new TextRun({ text: `更新于: ${data.date}`, size: 20, color: "666666" })],
        alignment: AlignmentType ? AlignmentType.CENTER : "center",
        spacing: { after: 400 }
      }));

      // Sections & Experiences
      data.sections.forEach(section => {
        // Section Header
        children.push(new Paragraph({
          children: [new TextRun({ text: section.title, bold: true, size: 28 })],
          spacing: { before: 400, after: 200 },
          border: { bottom: { color: "E5E7EB", space: 1, style: "single", size: 6 } }
        }));

        section.experiences.forEach(exp => {
          // Company & Duration
          children.push(new Paragraph({
            children: [
              new TextRun({ text: exp.company, bold: true, size: 24 }),
              new TextRun({ text: "    ", size: 24 }), // tab spacer
              new TextRun({ text: exp.duration, size: 20, color: "666666" })
            ],
            spacing: { before: 200 }
          }));

          // Position
          children.push(new Paragraph({
            children: [new TextRun({ text: exp.position, italics: true, color: "8b5cf6", size: 22 })],
            spacing: { after: 100 }
          }));

          // Bullet Points
          exp.description.forEach(point => {
            children.push(new Paragraph({
              children: [new TextRun({ text: `• ${point}`, size: 20 })],
              indent: { left: 720 },
              spacing: { after: 50 }
            }));
          });
        });
      });

      const doc = new Document({
        sections: [{
          properties: {},
          children: children
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${data.title}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) { 
        console.error("Word Export Error:", e); 
        alert("Word 导出失败，请尝试刷新页面重试。");
    } finally { 
        setIsExporting(false); 
        setShowExportMenu(false); 
    }
  };

  const handleExportPPT = async () => {
    const data = previewLanguage === 'EN' ? (translatedResume || selectedResume) : selectedResume;
    if (!data) return;
    setIsExporting(true);
    try {
      // @ts-ignore
      let PptxGen = window.PptxGenJS;
      if (!PptxGen) throw new Error("PptxGenJS not loaded");
      let pres = new PptxGen();
      
      let slide1 = pres.addSlide();
      slide1.addText(data.title, { x: 1, y: 2.5, w: '80%', fontSize: 44, bold: true, align: 'center', color: '363636' });
      slide1.addText(`职引 CareerPath 自动生成\n${data.date}`, { x: 1, y: 3.5, w: '80%', fontSize: 20, align: 'center', color: '888888' });

      data.sections.forEach(section => {
        let slide = pres.addSlide();
        slide.addText(section.title, { x: 0.5, y: 0.5, w: '90%', fontSize: 32, bold: true, color: '885cf6' });
        
        section.experiences.forEach((exp, idx) => {
          let yOffset = 1.2 + (idx * 2.5);
          if (yOffset > 6) { 
            slide = pres.addSlide();
            yOffset = 1.2;
          }
          slide.addText(`${exp.company} | ${exp.duration}`, { x: 0.7, y: yOffset, w: '90%', fontSize: 18, bold: true });
          slide.addText(exp.position, { x: 0.7, y: yOffset + 0.3, w: '90%', fontSize: 16, italic: true, color: '666666' });
          slide.addText(exp.description.map(p => `• ${p}`).join('\n'), { x: 0.7, y: yOffset + 0.7, w: '90%', fontSize: 12, color: '444444' });
        });
      });

      pres.writeFile({ fileName: `${data.title}.pptx` });
    } catch (e) { 
        console.error("PPT Export Error:", e); 
        alert("PPT 导出失败，请重试。");
    } finally { 
        setIsExporting(false); 
        setShowExportMenu(false); 
    }
  };

  const openResumeDetail = (resume: Resume) => {
    setSelectedResume(resume);
    setTranslatedResume(null);
    setCurrentView('resume-detail');
  };

  const openEditExperience = (exp: InternshipExperience) => {
    setEditingExperience({ ...exp });
    setCurrentView('edit-experience');
  };

  const handleSaveExperienceEdit = () => {
    if (!editingExperience) return;
    setExperiences(prev => prev.map(e => e.id === editingExperience.id ? editingExperience : e));
    setCurrentView('database');
  };

  const handleDeleteExperience = (id: string) => {
    const experienceToDelete = experiences.find(e => e.id === id);
    if (experienceToDelete) {
      setExperiences(prev => prev.filter(e => e.id !== id));
      setDeletedExperiences(prev => [{ ...experienceToDelete, deletedAt: Date.now() }, ...prev]);
    }
  };

  const handleRestoreExperience = (id: string) => {
    const experienceToRestore = deletedExperiences.find(e => e.id === id);
    if (experienceToRestore) {
      setDeletedExperiences(prev => prev.filter(e => e.id !== id));
      const { deletedAt, ...rest } = experienceToRestore;
      setExperiences(prev => [rest as InternshipExperience, ...prev]);
    }
  };

  const handleHardDeleteExperience = (id: string) => {
    setDeletedExperiences(prev => prev.filter(e => e.id !== id));
  };

  const ResumeDocument = ({ data, template }: { data: Resume | null, template: any }) => {
    if (!data) return null;
    return (
      <div className={`space-y-8 ${template.font}`}>
        <div className="text-center border-b-2 border-slate-900 pb-6">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{data.title}</h1>
          <div className="flex justify-center gap-4 mt-2 text-[11px] text-slate-500 font-bold uppercase tracking-widest">
            <span>Last Updated: {data.date}</span>
            <span>•</span>
            <span>Professional CV</span>
          </div>
        </div>
        
        {data.sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-5">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${template.color}`}></div>
              <h3 className={`text-sm font-black uppercase tracking-widest text-slate-900`}>
                {section.title}
              </h3>
              <div className="flex-1 h-[1px] bg-slate-100"></div>
            </div>
            <div className="space-y-6 ml-6 border-l-2 border-slate-50 pl-6">
              {section.experiences.map((exp, eIdx) => (
                <div key={eIdx} className="space-y-2 relative">
                  <div className="absolute -left-[1.85rem] top-1.5 w-2 h-2 rounded-full bg-white border-2 border-slate-200"></div>
                  <div className="flex justify-between items-baseline">
                    <h4 className="font-bold text-slate-800 text-base">{exp.company}</h4>
                    <span className="text-[11px] text-slate-400 font-bold">{exp.duration}</span>
                  </div>
                  <p className="text-sm font-bold text-violet-500">{exp.position}</p>
                  <ul className="list-disc list-inside space-y-1.5">
                    {exp.description.map((point, pIdx) => (
                      <li key={pIdx} className="text-xs text-slate-600 leading-relaxed pl-1">{point}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderHomeContent = () => (
    <div className="flex flex-col h-full bg-[#faf9ff]">
      <div className="chat-gradient relative z-30 h-[280px] rounded-b-[50px] flex flex-col shadow-lg shadow-purple-50/50">
        <div className="pt-10 px-6 flex justify-between items-center text-white pb-4">
          <MenuIcon className="w-6 h-6" />
          <div className="flex gap-2 bg-black/10 backdrop-blur-md px-3 py-1.5 rounded-full items-center border border-white/10">
            <DotsIcon className="w-5 h-5" />
            <div className="w-[1px] h-4 bg-white/20"></div>
            <CircleIcon className="w-5 h-5" />
          </div>
        </div>
        <div className="px-6 mt-1">
          <p className="text-white/80 text-[13px] font-medium tracking-wide">欢迎使用 CareerPath职引</p>
          <h1 className="text-white text-[28px] font-bold mt-0.5 tracking-tight leading-tight">和我分享经历来<br />生成简历吧</h1>
        </div>
        <div className="flex-1 flex flex-col justify-center px-6">
          <div onClick={() => setCurrentView('chat')} className="bg-white rounded-3xl p-2.5 flex items-center cursor-pointer transition-all active:scale-[0.98] shadow-2xl shadow-purple-900/10 border border-purple-50/50">
            <div className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-colors ${isListening ? 'bg-rose-100' : 'bg-gray-50'}`} onClick={toggleListening}><PhoneIcon className={`w-5 h-5 ${isListening ? 'text-rose-400 animate-pulse' : 'text-slate-700'}`} /></div>
            <div className="flex-1 px-3 text-gray-300 text-sm font-medium">发消息 or 按住说话...</div>
            <div className="flex items-center pr-1"><div className="w-9 h-9 bg-violet-50 rounded-2xl flex items-center justify-center"><SendIcon className="w-5 h-5 text-violet-400" /></div></div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-6 pb-[116px] flex flex-col">
        <div className="bg-white rounded-[40px] p-2.5 flex flex-col items-center overflow-hidden flex-1 shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-purple-50/20">
          <div className="bg-[#f7f8fc] rounded-[36px] p-6 w-full flex-1 flex flex-col items-center justify-center">
            <div className="grid grid-cols-1 gap-4 w-full px-1">
              <div onClick={() => setCurrentView('chat')} className="w-full bg-white rounded-[30px] p-5 flex items-center cursor-pointer active:scale-[0.97] transition-all shadow-sm shadow-indigo-100/10 border border-white">
                <div className="w-14 h-14 bg-[#fbfaff] rounded-2xl flex items-center justify-center mr-4 shadow-sm"><svg className="w-7 h-7 text-violet-300" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 11H7V9h2v2zm4 0h-2V9h2v2zm4 0h-2V9h2v2z"/></svg></div>
                <div className="flex-1"><h4 className="font-bold text-slate-800 text-[16px]">AI对话创建</h4><p className="text-[11px] text-slate-400 mt-0.5">对话式快捷整理工作经历</p></div>
              </div>
              <div className="w-full bg-white rounded-[30px] p-5 flex items-center cursor-pointer active:scale-[0.97] transition-all shadow-sm shadow-indigo-100/10 border border-white">
                <div className="w-14 h-14 bg-[#fbfaff] rounded-2xl flex items-center justify-center mr-4 shadow-sm"><svg className="w-7 h-7 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                <div className="flex-1"><h4 className="font-bold text-slate-800 text-[16px]">导入简历</h4><p className="text-[11px] text-slate-400 mt-0.5">智能分析已有文档并优化</p></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderResumeContent = () => (
    <div className="flex flex-col h-full bg-[#faf9ff] relative">
      <div className="absolute top-0 left-0 right-0 h-[280px] bg-gradient-to-b from-[#f3e8ff]/50 to-transparent z-0 rounded-b-[48px]" />
      <div className="relative z-10 pt-12 px-6 flex justify-between items-center mb-6">
        <h2 className="text-slate-900 text-2xl font-bold">我的简历</h2>
        <div className="flex gap-2 bg-white/60 backdrop-blur-md px-3 py-1.5 rounded-full items-center border border-white">
          <DotsIcon className="w-5 h-5 text-slate-800" />
          <div className="w-[1px] h-4 bg-slate-300"></div>
          <CircleIcon className="w-5 h-5 text-slate-800" />
        </div>
      </div>
      <div className="relative z-10 px-6 flex-1 overflow-y-auto no-scrollbar pb-32">
        <div className="space-y-4">
          {resumeHistory.map((resume) => (
            <div 
              key={resume.id} 
              onClick={() => openResumeDetail(resume)}
              className="bg-white rounded-[32px] p-6 shadow-sm border border-purple-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-400">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${resume.status === '已导出' ? 'bg-emerald-50 text-emerald-500' : 'bg-orange-50 text-orange-500'}`}>
                  {resume.status}
                </span>
              </div>
              <h3 className="text-slate-800 font-bold text-lg mb-1">{resume.title}</h3>
              <p className="text-slate-400 text-[11px] font-medium tracking-wide">更新于 {resume.date}</p>
            </div>
          ))}
          <button onClick={() => setCurrentView('chat')} className="w-full py-8 border-2 border-dashed border-purple-100 rounded-[32px] flex flex-col items-center justify-center gap-2 group active:scale-[0.98] transition-all bg-white/30">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-violet-400 shadow-sm group-hover:scale-110 transition-transform">
              <PlusIcon className="w-6 h-6" />
            </div>
            <span className="text-violet-300 text-sm font-bold">创建新简历</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderResumeDetailView = () => (
    <div className="flex flex-col h-full bg-[#faf9ff] animate-slide-up">
      <div className="pt-12 px-6 flex justify-between items-center mb-6">
        <button onClick={() => setCurrentView('resume')} className="w-10 h-10 flex items-center justify-center -ml-2 active:scale-90 transition-transform"><ChevronLeftIcon className="w-7 h-7 text-slate-800" /></button>
        <h2 className="text-slate-800 text-lg font-bold">编辑简历</h2>
        <div className="flex gap-2 bg-white/60 backdrop-blur-md px-3 py-1.5 rounded-full items-center border border-white"><DotsIcon className="w-5 h-5 text-slate-800" /><div className="w-[1px] h-4 bg-slate-300"></div><CircleIcon className="w-5 h-5 text-slate-800" /></div>
      </div>
      <div className="flex-1 px-6 overflow-y-auto no-scrollbar pb-10">
        <div className="mb-6"><h1 className="text-2xl font-bold text-slate-800 mb-1">{selectedResume?.title}</h1><p className="text-sm text-slate-400">最后编辑于 {selectedResume?.date}</p></div>
        {selectedResume?.sections.map((section, idx) => (
          <div key={idx} className="mb-8">
            <h3 className="text-slate-800 font-bold text-base mb-4 flex items-center gap-2"><span className="w-1 h-4 bg-violet-400 rounded-full"></span>{section.title}</h3>
            <div className="space-y-4">{section.experiences.map((exp, eIdx) => (<ExperienceCard key={eIdx} experience={exp} variant="list" onEdit={openEditExperience} />))}</div>
          </div>
        ))}
        <div className="flex gap-3 mt-6">
          <button onClick={() => setCurrentView('preview')} className="flex-1 py-4 bg-white border border-purple-100 rounded-[24px] text-purple-400 font-bold text-sm shadow-sm active:bg-purple-50 transition-colors">预览简历</button>
          <button onClick={() => setShowExportMenu(true)} className="flex-1 py-4 bg-gradient-to-r from-violet-400 to-rose-300 text-white rounded-[24px] font-bold text-sm shadow-lg shadow-purple-100 active:scale-[0.98]">一键导出</button>
        </div>
      </div>
    </div>
  );

  const renderPreviewView = () => {
    const resumeToDisplay = previewLanguage === 'EN' ? (translatedResume || selectedResume) : selectedResume;
    const currentTemplate = templates.find(t => t.name === selectedTemplate) || templates[0];
    const handleTranslate = async () => {
      if (!selectedResume || isTranslating) return;
      setIsTranslating(true);
      try {
        const result = await translateResumeContent(selectedResume, 'EN');
        if (result) setTranslatedResume(result);
      } catch (err) { console.error(err); } finally { setIsTranslating(false); }
    };

    return (
      <div className="flex flex-col h-full bg-[#f8f9fa] animate-slide-up">
        <div className="pt-12 px-6 flex justify-between items-center mb-6">
          <button onClick={() => setCurrentView('resume-detail')} className="w-10 h-10 flex items-center justify-center -ml-2 active:scale-90 transition-transform"><ChevronLeftIcon className="w-7 h-7 text-slate-800" /></button>
          <h2 className="text-slate-800 text-lg font-bold">简历预览</h2>
          <div className="w-10"></div>
        </div>
        <div className="flex-1 px-4 overflow-y-auto no-scrollbar pb-32">
          <div className="flex gap-3 overflow-x-auto no-scrollbar mb-6 px-2">
            {templates.map(t => (
              <button key={t.id} onClick={() => setSelectedTemplate(t.name)} className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedTemplate === t.name ? 'bg-violet-500 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-100'}`}>{t.name}</button>
            ))}
          </div>
          <div className="bg-white rounded-2xl p-1 flex mb-6 shadow-sm border border-slate-100 mx-2">
            <button onClick={() => setPreviewLanguage('CH')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${previewLanguage === 'CH' ? 'bg-violet-50 text-violet-500' : 'text-slate-400'}`}>中文原文</button>
            <button onClick={() => { setPreviewLanguage('EN'); if (!translatedResume) handleTranslate(); }} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${previewLanguage === 'EN' ? 'bg-violet-50 text-violet-500' : 'text-slate-400'}`}>{isTranslating ? '正在翻译...' : '英文预览'}</button>
          </div>
          
          <div className="bg-white shadow-xl mx-2 p-10 min-h-[600px] rounded-sm border border-slate-100 relative">
            {isTranslating && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                    <div className="w-10 h-10 border-4 border-violet-100 border-t-violet-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-400 text-sm font-medium">AI 正在为您翻译简历...</p>
                </div>
            )}
            <ResumeDocument data={resumeToDisplay} template={currentTemplate} />
          </div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent pt-10 z-50">
          <button onClick={() => setShowExportMenu(true)} className="w-full py-4 bg-slate-900 text-white rounded-[24px] font-bold shadow-xl active:scale-[0.98] flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            导出简历
          </button>
        </div>
      </div>
    );
  };

  const renderExportMenu = () => {
    const resumeToExport = previewLanguage === 'EN' ? (translatedResume || selectedResume) : selectedResume;
    const currentTemplate = templates.find(t => t.name === selectedTemplate) || templates[0];

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isExporting && setShowExportMenu(false)}></div>
        
        {/* Hidden Printable Resume - Ensures ref is always available for DOM exports */}
        <div className="fixed left-[-9999px] top-0 opacity-0 pointer-events-none">
            <div 
                ref={resumeRef} 
                style={{ width: '210mm', backgroundColor: 'white', padding: '20mm' }}
            >
                <ResumeDocument data={resumeToExport} template={currentTemplate} />
            </div>
        </div>

        <div className="relative w-full max-w-md bg-white rounded-t-[40px] p-8 shadow-2xl animate-slide-up safe-area-bottom">
            <div className="flex justify-between items-center mb-8">
            <h3 className="text-slate-900 text-xl font-bold tracking-tight">导出至</h3>
            <button onClick={() => setShowExportMenu(false)} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center"><PlusIcon className="w-5 h-5 text-slate-400 rotate-45" /></button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-2">
            <button onClick={handleExportPDF} disabled={isExporting} className="flex flex-col items-center gap-4 p-6 bg-rose-50 rounded-[32px] border border-rose-100 active:scale-95 transition-all">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm text-rose-500"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5zm4 4h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg></div>
                <span className="text-sm font-bold text-rose-600">PDF 文件</span>
            </button>
            
            <button onClick={handleExportImage} disabled={isExporting} className="flex flex-col items-center gap-4 p-6 bg-blue-50 rounded-[32px] border border-blue-100 active:scale-95 transition-all">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm text-blue-500"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>
                <span className="text-sm font-bold text-blue-600">图片保存</span>
            </button>

            <button onClick={handleExportWord} disabled={isExporting} className="flex flex-col items-center gap-4 p-6 bg-indigo-50 rounded-[32px] border border-indigo-100 active:scale-95 transition-all">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm text-indigo-500"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg></div>
                <span className="text-sm font-bold text-indigo-600">Word 文档</span>
            </button>

            <button onClick={handleExportPPT} disabled={isExporting} className="flex flex-col items-center gap-4 p-6 bg-orange-50 rounded-[32px] border border-orange-100 active:scale-95 transition-all">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm text-orange-500"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-4v-2h4v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg></div>
                <span className="text-sm font-bold text-orange-600">PPT 幻灯片</span>
            </button>
            </div>

            {isExporting && (
            <div className="mt-6 flex items-center justify-center gap-3 py-4 bg-slate-900 rounded-2xl animate-pulse">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                <span className="text-white text-sm font-bold">正在生成文件...</span>
            </div>
            )}
        </div>
        </div>
    );
  };

  const renderDatabaseContent = () => {
    const categories = ['全部', '实习', '工作', '项目', '校园'];
    const filteredExperiences = activeCategory === '全部' ? experiences : experiences.filter(e => e.category === activeCategory);
    return (
      <div className="flex flex-col h-full bg-[#faf9ff] relative">
        <div className="absolute top-0 left-0 right-0 h-[280px] bg-gradient-to-b from-[#f3e8ff]/50 to-transparent z-0 rounded-b-[48px]" />
        <div className="relative z-10 pt-12 px-6 flex justify-between items-center mb-6"><h2 className="text-slate-900 text-2xl font-bold">资料库</h2><div className="flex gap-2 bg-white/60 backdrop-blur-md px-3 py-1.5 rounded-full items-center border border-white"><DotsIcon className="w-5 h-5 text-slate-800" /><div className="w-[1px] h-4 bg-slate-300"></div><CircleIcon className="w-5 h-5 text-slate-800" /></div></div>
        <div className="relative z-10 px-6 flex-1 overflow-y-auto no-scrollbar pb-32">
          <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar pb-1">{categories.map((cat) => (<button key={cat} onClick={() => setActiveCategory(cat)} className={`px-5 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-gradient-to-r from-violet-400 to-rose-300 text-white shadow-lg' : 'bg-white text-slate-400 border border-purple-50/50'}`}>{cat}</button>))}</div>
          <div className="space-y-4">{filteredExperiences.map((exp) => (<ExperienceCard key={exp.id} experience={exp} variant="list" onEdit={openEditExperience} onDelete={handleDeleteExperience} />))}</div>
        </div>
        <div className="absolute bottom-28 left-6 flex gap-4 pointer-events-none z-40 w-[calc(100%-48px)]">
          <button onClick={() => setCurrentView('recycle-bin')} className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl border border-purple-50 active:scale-90 pointer-events-auto">
            <div className="relative"><svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>{deletedExperiences.length > 0 && (<div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-400 rounded-full border-2 border-white flex items-center justify-center text-[8px] text-white font-black">{deletedExperiences.length}</div>)}</div>
          </button>
          <div className="flex-1"></div>
          <button onClick={() => setCurrentView('chat')} className="w-16 h-16 bg-gradient-to-tr from-violet-400 to-rose-300 rounded-full flex items-center justify-center shadow-2xl active:scale-90 pointer-events-auto"><PlusIcon className="w-8 h-8 text-white" /></button>
        </div>
      </div>
    );
  };

  const renderProfileContent = () => (
    <div className="flex flex-col h-full bg-[#faf9ff]">
      <div className="absolute top-0 left-0 right-0 h-[280px] bg-gradient-to-b from-[#f3e8ff]/50 to-transparent z-0 rounded-b-[48px]" />
      <div className="relative z-10 pt-12 px-6 flex justify-between items-center mb-6"><h2 className="text-slate-900 text-2xl font-bold">个人中心</h2><div className="flex gap-2 bg-white/60 backdrop-blur-md px-3 py-1.5 rounded-full items-center border border-white"><DotsIcon className="w-5 h-5 text-slate-800" /><div className="w-[1px] h-4 bg-slate-300"></div><CircleIcon className="w-5 h-5 text-slate-800" /></div></div>
      <div className="relative z-10 px-6 flex-1 overflow-y-auto no-scrollbar pb-32">
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-purple-50 flex flex-col items-center">
          <div className="w-24 h-24 bg-gradient-to-tr from-violet-400 to-rose-300 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-purple-50"><svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>
          <h3 className="text-slate-900 text-xl font-bold">CareerPath 用户</h3>
          <p className="text-slate-400 text-sm mt-1">寻找：产品经理实习</p>
          <div className="grid grid-cols-3 gap-8 w-full mt-8 pt-8 border-t border-purple-50/50"><div className="text-center"><p className="text-slate-900 font-bold text-lg">12</p><p className="text-slate-400 text-[10px] font-medium tracking-tighter">整理经历</p></div><div className="text-center"><p className="text-slate-900 font-bold text-lg">4</p><p className="text-slate-400 text-[10px] font-medium tracking-tighter">生成简历</p></div><div className="text-center"><p className="text-slate-900 font-bold text-lg">8</p><p className="text-slate-400 text-[10px] font-medium tracking-tighter">修改次数</p></div></div>
        </div>
        <div className="w-full bg-white rounded-[40px] p-8 grid grid-cols-3 gap-4 my-6 shadow-sm border border-purple-50">
          <div className="flex flex-col items-center gap-3 cursor-pointer" onClick={() => setCurrentView('resume')}><div className="w-14 h-14 bg-violet-50/50 rounded-2xl flex items-center justify-center text-violet-300"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg></div><span className="text-[11px] text-slate-600 font-bold">简历列表</span></div>
          <div className="flex flex-col items-center gap-3 cursor-pointer" onClick={() => setCurrentView('database')}><div className="w-14 h-14 bg-rose-50/50 rounded-2xl flex items-center justify-center text-rose-300"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg></div><span className="text-[11px] text-slate-600 font-bold">资料库</span></div>
          <div className="flex flex-col items-center gap-3 cursor-pointer"><div className="w-14 h-14 bg-indigo-50/50 rounded-2xl flex items-center justify-center text-indigo-300"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></div><span className="text-[11px] text-slate-600 font-bold">会员权益</span></div>
        </div>
      </div>
    </div>
  );

  const renderEditExperienceView = () => (
    <div className="flex flex-col h-full bg-white animate-slide-up overflow-hidden">
      <div className="pt-12 px-6 flex justify-between items-center mb-8 border-b border-gray-50 pb-4">
        <button onClick={() => setCurrentView('database')} className="w-10 h-10 flex items-center justify-center -ml-2 active:scale-90 bg-gray-50 rounded-full"><ChevronLeftIcon className="w-6 h-6 text-slate-800" /></button>
        <h2 className="text-slate-800 text-lg font-bold">编辑经历</h2>
        <button onClick={handleSaveExperienceEdit} className="text-violet-500 font-bold text-sm px-5 py-2.5 bg-violet-50 rounded-2xl active:scale-95 transition-all">保存</button>
      </div>
      <div className="flex-1 px-6 overflow-y-auto no-scrollbar pb-10">
        <div className="space-y-6">
          <div className="flex flex-col gap-2"><label className="text-[10px] font-black text-slate-400 tracking-widest uppercase ml-1">公司名称</label><input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-[20px] px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:border-violet-200 transition-all" value={editingExperience?.company || ''} onChange={(e) => setEditingExperience(prev => prev ? {...prev, company: e.target.value} : null)}/></div>
          <div className="flex flex-col gap-2"><label className="text-[10px] font-black text-slate-400 tracking-widest uppercase ml-1">职位名称</label><input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-[20px] px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:border-violet-200 transition-all" value={editingExperience?.position || ''} onChange={(e) => setEditingExperience(prev => prev ? {...prev, position: e.target.value} : null)}/></div>
          <div className="flex flex-col gap-2"><label className="text-[10px] font-black text-slate-400 tracking-widest uppercase ml-1">起止日期</label><input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-[20px] px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:border-violet-200 transition-all" value={editingExperience?.duration || ''} onChange={(e) => setEditingExperience(prev => prev ? {...prev, duration: e.target.value} : null)}/></div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase ml-1">工作描述</label>
            {editingExperience?.description.map((point, idx) => (<textarea key={idx} className="w-full bg-slate-50 border border-slate-100 rounded-[20px] px-5 py-4 text-sm font-medium text-slate-600 outline-none focus:border-violet-200 transition-all min-h-[100px] mb-2" value={point} onChange={(e) => { const newDesc = [...(editingExperience?.description || [])]; newDesc[idx] = e.target.value; setEditingExperience(prev => prev ? {...prev, description: newDesc} : null); }}/>))}
            <button onClick={() => { const newDesc = [...(editingExperience?.description || []), '']; setEditingExperience(prev => prev ? {...prev, description: newDesc} : null); }} className="mt-2 py-3 border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 text-xs font-bold">+ 添加一条描述</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRecycleBinView = () => (
    <div className="flex flex-col h-full bg-[#fafaff] animate-slide-up">
      <div className="pt-12 px-6 flex justify-between items-center mb-6 bg-white pb-4 shadow-sm">
        <button onClick={() => setCurrentView('database')} className="w-10 h-10 flex items-center justify-center -ml-2 active:scale-90 transition-transform"><ChevronLeftIcon className="w-7 h-7 text-slate-800" /></button>
        <h2 className="text-slate-800 text-2xl font-bold">回收站</h2>
        <div className="flex gap-2 bg-gray-50 px-3 py-1.5 rounded-full items-center border border-gray-100"><DotsIcon className="w-5 h-5 text-slate-800" /><div className="w-[1px] h-4 bg-slate-200"></div><CircleIcon className="w-5 h-5 text-slate-800" /></div>
      </div>
      <div className="px-6 pb-6"><div className="bg-[#e9f3ff] rounded-[16px] p-5 border border-[#cce4ff]"><p className="text-[#007aff] font-bold text-base mb-1">共{deletedExperiences.length}条待恢复经历</p><p className="text-[#007aff]/60 text-sm font-medium">回收站中的经历保留30天后将自动永久删除</p></div></div>
      <div className="flex-1 px-6 overflow-y-auto no-scrollbar pb-10">
        {deletedExperiences.length > 0 ? (<div className="space-y-4">{deletedExperiences.map((exp) => (<ExperienceCard key={exp.id} experience={exp} variant="recycle" onRestore={handleRestoreExperience} onHardDelete={handleHardDeleteExperience} />))}</div>) : (<div className="flex flex-col items-center justify-center pt-40 opacity-40"><h3 className="text-slate-400 text-xl font-bold mb-2">回收站为空</h3><p className="text-slate-400 text-sm font-medium">已删除的经历将显示在这里</p></div>)}
      </div>
    </div>
  );

  const renderChatView = () => (
    <div className="flex-1 flex flex-col overflow-hidden h-full relative z-30">
      <div className="chat-gradient fixed top-0 left-0 right-0 h-full z-0 transition-all duration-700" />
      <div className="relative z-40 pt-12 px-6 flex justify-between items-center text-white pb-4 glass-panel border-none bg-transparent">
        <button onClick={() => setCurrentView('home')} className="w-10 h-10 flex items-center justify-center -ml-2 active:scale-90 transition-transform bg-white/10 rounded-full backdrop-blur-md"><ChevronLeftIcon className="w-6 h-6" /></button>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2"><div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div><span className="text-white/95 font-bold text-base tracking-wide">职引 AI 顾问</span></div>
          <span className="text-white/60 text-[10px] font-medium tracking-widest mt-0.5 uppercase">Professional Interviewing</span>
        </div>
        <div className="flex gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full items-center border border-white/10"><DotsIcon className="w-5 h-5" /><div className="w-[1px] h-4 bg-white/20"></div><CircleIcon className="w-5 h-5" /></div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden relative z-30">
        <div ref={scrollRef} className="flex-1 bg-[#fbfaff] rounded-t-[40px] px-6 pt-8 pb-64 overflow-y-auto no-scrollbar shadow-[0_-20px_60px_rgba(0,0,0,0.06)]">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col mb-8 animate-message-pop ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.isStructured && msg.structuredData ? (
                <div className="w-full flex justify-start"><ExperienceCard experience={msg.structuredData} onSave={() => { const newExp = { ...msg.structuredData!, id: `e${Date.now()}` }; setExperiences(prev => [newExp, ...prev]); setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: '✅ 经历已成功保存到您的资料库！您想继续整理下一段经历，还是去看看简历预览？' }]); setDynamicPrompts(['继续整理经历', '预览简历']); }} /></div>
              ) : (
                <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {msg.role === 'assistant' && (<div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-400 to-rose-300 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm"><svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>)}
                  <div className={`max-w-[82%] px-5 py-3.5 rounded-[22px] text-sm font-medium leading-relaxed shadow-sm ${msg.role === 'user' ? 'user-message-gradient text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-purple-50/50'}`}>{msg.content.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}</div>
                </div>
              )}
            </div>
          ))}
          {isTyping && (<div className="flex items-center space-x-2 bg-white w-fit px-5 py-4 rounded-full shadow-sm ml-11 border border-purple-50 animate-message-pop"><div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-rose-300 rounded-full animate-bounce delay-100"></div><div className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce delay-200"></div></div>)}
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 glass-panel p-5 safe-area-bottom z-50 rounded-t-[40px] border-t border-purple-100/50 animate-slide-up">
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 px-1">{dynamicPrompts.map(p => (<button key={p} onClick={() => handleSendMessage(p)} className={`px-4 py-2 border rounded-full text-[11px] font-bold whitespace-nowrap active:scale-95 transition-all ${p.includes('✨') ? 'bg-violet-50 border-violet-200 text-violet-500' : 'bg-white/50 border-purple-50 text-slate-500'}`}>{p}</button>))}</div>
        <div className="bg-gray-50/50 rounded-[32px] p-2 pr-3 flex items-center border border-purple-50/50 shadow-inner">
          <button className={`w-11 h-11 flex items-center justify-center transition-colors rounded-full ${isListening ? 'bg-rose-100' : 'text-slate-300'}`} onClick={toggleListening}><PhoneIcon className={`w-6 h-6 ${isListening ? 'text-rose-400 animate-pulse' : ''}`} /></button>
          <input type="text" placeholder={isListening ? "正在聆听您的讲述..." : "分享您的工作细节..."} className="flex-1 bg-transparent outline-none px-3 text-slate-700 text-sm font-bold" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} />
          <button onClick={() => handleSendMessage()} className="w-11 h-11 bg-gradient-to-tr from-violet-400 to-rose-300 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all"><SendIcon className="w-6 h-6 text-white" /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full flex flex-col bg-white relative overflow-hidden text-slate-900">
      <div className="flex-1 relative z-20 flex flex-col overflow-hidden">
        {currentView === 'home' && renderHomeContent()}
        {currentView === 'resume' && renderResumeContent()}
        {currentView === 'resume-detail' && renderResumeDetailView()}
        {currentView === 'edit-experience' && renderEditExperienceView()}
        {currentView === 'database' && renderDatabaseContent()}
        {currentView === 'profile' && renderProfileContent()}
        {currentView === 'chat' && renderChatView()}
        {currentView === 'preview' && renderPreviewView()}
        {currentView === 'recycle-bin' && renderRecycleBinView()}
      </div>
      {['home', 'resume', 'profile', 'database'].includes(currentView) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md h-[92px] border-t border-gray-100 flex justify-around items-center px-6 pb-6 z-40 rounded-t-[40px] shadow-[0_-8px_30px_rgba(0,0,0,0.02)]">
          <div onClick={() => setCurrentView('home')} className={`flex flex-col items-center cursor-pointer ${currentView === 'home' ? 'text-violet-400' : 'text-slate-300'}`}><svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg><span className="text-[10px] font-bold">首页</span></div>
          <div onClick={() => setCurrentView('resume')} className={`flex flex-col items-center cursor-pointer ${currentView === 'resume' ? 'text-violet-400' : 'text-slate-300'}`}><svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><span className="text-[10px] font-bold">简历</span></div>
          <div onClick={() => setCurrentView('database')} className={`flex flex-col items-center cursor-pointer ${currentView === 'database' ? 'text-violet-400' : 'text-slate-300'}`}><svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg><span className="text-[10px] font-bold">资料库</span></div>
          <div onClick={() => setCurrentView('profile')} className={`flex flex-col items-center cursor-pointer ${currentView === 'profile' ? 'text-violet-400' : 'text-slate-300'}`}><svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg><span className="text-[10px] font-bold">我的</span></div>
        </div>
      )}
      {showExportMenu && renderExportMenu()}
    </div>
  );
};

export default App;
