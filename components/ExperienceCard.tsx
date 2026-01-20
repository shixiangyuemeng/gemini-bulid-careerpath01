
import React, { useState } from 'react';
import { InternshipExperience } from '../types';
import { DotsIcon } from './Icons';

interface ExperienceCardProps {
  experience: InternshipExperience;
  onEdit?: (exp: InternshipExperience) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onHardDelete?: (id: string) => void;
  onSave?: () => void;
  variant?: 'chat' | 'list' | 'recycle';
}

const ExperienceCard: React.FC<ExperienceCardProps> = ({ experience, onEdit, onDelete, onRestore, onHardDelete, onSave, variant = 'chat' }) => {
  const [showMenu, setShowMenu] = useState(false);

  if (variant === 'recycle') {
    return (
      <div className="bg-white rounded-[24px] p-5 shadow-sm border border-purple-50 mb-4 flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <h3 className="text-[17px] font-bold text-slate-900">{experience.company}</h3>
            <p className="text-[13px] text-slate-500">
              {experience.position} <span className="text-gray-300">|</span> {experience.duration}
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <button 
            onClick={() => experience.id && onRestore?.(experience.id)}
            className="flex-1 py-2 rounded-xl bg-violet-50 text-violet-500 font-bold text-xs active:bg-violet-100 transition-colors"
          >
            恢复经历
          </button>
          <button 
            onClick={() => experience.id && onHardDelete?.(experience.id)}
            className="flex-1 py-2 rounded-xl bg-gray-50 text-gray-400 font-bold text-xs active:bg-gray-100 transition-colors"
          >
            彻底删除
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="relative mb-4">
        <div 
          onClick={() => !showMenu && onEdit?.(experience)}
          className="bg-white rounded-[24px] p-5 shadow-sm border border-purple-50 active:scale-[0.98] transition-all cursor-pointer"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-[17px] font-bold text-slate-900">{experience.company}</h3>
              {experience.status === 'pending' && (
                <span className="bg-rose-50 text-rose-400 text-[10px] px-2 py-0.5 rounded-md font-bold border border-rose-100/50">
                  待完善
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <div 
                className="p-1 -mr-1"
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              >
                <DotsIcon className="w-5 h-5 text-gray-200" />
              </div>
            </div>
          </div>
          
          <p className="text-[13px] text-slate-500 mb-3 flex items-center gap-1">
            {experience.position} <span className="text-gray-300">|</span> {experience.duration}
          </p>
          
          <p className="text-[13px] text-slate-400 line-clamp-2 leading-relaxed">
            {experience.description.join('；')}
          </p>
        </div>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
            <div className="absolute right-0 top-12 bg-white rounded-2xl shadow-xl border border-gray-100 z-20 py-2 min-w-[120px] animate-message-pop">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); onEdit?.(experience); }}
                className="w-full text-left px-5 py-3 text-sm text-slate-700 font-medium active:bg-gray-50"
              >
                编辑
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); experience.id && onDelete?.(experience.id); }}
                className="w-full text-left px-5 py-3 text-sm text-rose-400 font-bold border-t border-gray-50 active:bg-rose-50"
              >
                删除经历
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-purple-100/50 my-4 w-full max-w-sm">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{experience.company}</h3>
          <p className="text-purple-500/80 font-medium text-sm">{experience.position}</p>
        </div>
        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">{experience.duration}</span>
      </div>
      
      <div className="space-y-2">
        {experience.description.map((point, idx) => (
          <div key={idx} className="flex gap-2">
            <div className="min-w-[4px] h-[4px] bg-purple-300 rounded-full mt-2"></div>
            <p className="text-sm text-gray-600 leading-relaxed">{point}</p>
          </div>
        ))}
      </div>

      {onSave && (
        <button 
          onClick={onSave}
          className="mt-4 w-full py-2.5 bg-gradient-to-r from-violet-400 to-rose-300 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shadow-lg shadow-purple-100"
        >
          保存到资料库
        </button>
      )}
    </div>
  );
};

export default ExperienceCard;
