
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStructured?: boolean;
  structuredData?: InternshipExperience;
}

export interface InternshipExperience {
  id?: string;
  company: string;
  position: string;
  duration: string;
  description: string[];
  location?: string;
  category?: '实习' | '工作' | '项目' | '校园' | string;
  status?: 'completed' | 'pending';
  deletedAt?: number;
}

export interface Resume {
  id: string;
  title: string;
  date: string;
  status: string;
  sections: {
    title: string;
    experiences: InternshipExperience[];
  }[];
}

export type AppView = 'home' | 'chat' | 'resume' | 'profile' | 'resume-detail' | 'edit-experience' | 'database' | 'interview' | 'preview' | 'recycle-bin';
