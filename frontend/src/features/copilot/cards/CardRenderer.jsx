import React from 'react';
import AtsScoreCard from './AtsScoreCard';
import LearningRoadmapCard from './LearningRoadmapCard';
import SkillGapCard from './SkillGapCard';
import InterviewQuestionCard from './InterviewQuestionCard';
import BulletDiffCard from './BulletDiffCard';
import JobMatchCard from './JobMatchCard';

export default function CardRenderer({ cardType, data }) {
  if (!cardType || !data) return null;

  switch (cardType) {
    case 'ats_score':
    case 'ats_match':
      return <AtsScoreCard data={data} />;
    case 'roadmap':
    case 'learning_roadmap':
      return <LearningRoadmapCard data={data} />;
    case 'skill_gap':
      return <SkillGapCard data={data} />;
    case 'interview_question':
    case 'interview_questions':
      return <InterviewQuestionCard data={data} />;
    case 'bullet_diff':
    case 'enhanced_bullet':
      return <BulletDiffCard data={data} />;
    case 'job_match':
    case 'jobs':
      return <JobMatchCard data={data} />;
    default:
      return null;
  }
}
