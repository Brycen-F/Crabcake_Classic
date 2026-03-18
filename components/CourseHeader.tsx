'use client';

import { CourseData } from '@/lib/types';

interface CourseHeaderProps {
  course: CourseData;
  round: number;
  matchLabel: string;
}

export default function CourseHeader({ course, round, matchLabel }: CourseHeaderProps) {
  const totalPar = course.par.reduce((sum, p) => sum + p, 0);
  const totalYards = course.yardages.reduce((sum, y) => sum + y, 0);

  return (
    <div className="relative overflow-hidden">
      {/* Hero Image Background */}
      {course.photo && (
        <div className="absolute inset-0">
          <img
            src={course.photo}
            alt={course.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-masters-black/60 via-masters-black/40 to-masters-black/80" />

      {/* Content */}
      <div className="relative px-4 py-6 text-white">
        {/* Round Badge */}
        <div className="flex items-center justify-center mb-3">
          <span className="px-3 py-1 text-xs font-semibold tracking-wider uppercase bg-masters-gold/90 text-masters-black rounded-full">
            Round {round}
          </span>
        </div>

        {/* Course Logo & Name */}
        <div className="flex flex-col items-center text-center">
          {course.logo && (
            <div className="w-20 h-20 mb-3 bg-white/95 rounded-full p-2 shadow-lg flex items-center justify-center">
              <img
                src={course.logo}
                alt={`${course.name} logo`}
                className="w-full h-full object-contain"
              />
            </div>
          )}

          <h1 className="text-2xl font-serif font-bold tracking-wide">
            {course.name}
          </h1>

          {course.designer && (
            <p className="text-sm text-white/80 mt-1 font-light italic">
              A {course.designer} Design
            </p>
          )}
        </div>

        {/* Course Stats */}
        <div className="flex justify-center gap-6 mt-4">
          <div className="text-center">
            <div className="text-lg font-bold">{totalYards.toLocaleString()}</div>
            <div className="text-xs text-white/70 uppercase tracking-wide">Yards</div>
          </div>
          <div className="w-px bg-white/30" />
          <div className="text-center">
            <div className="text-lg font-bold">{totalPar}</div>
            <div className="text-xs text-white/70 uppercase tracking-wide">Par</div>
          </div>
          <div className="w-px bg-white/30" />
          <div className="text-center">
            <div className="text-lg font-bold">{course.slope}</div>
            <div className="text-xs text-white/70 uppercase tracking-wide">Slope</div>
          </div>
          <div className="w-px bg-white/30" />
          <div className="text-center">
            <div className="text-lg font-bold">{course.rating}</div>
            <div className="text-xs text-white/70 uppercase tracking-wide">Rating</div>
          </div>
        </div>

        {/* Tees Badge */}
        <div className="flex justify-center mt-3">
          <span className="px-2 py-0.5 text-xs bg-white/20 rounded-full">
            {course.tees} Tees
          </span>
        </div>

        {/* Match Info */}
        <div className="mt-4 pt-4 border-t border-white/20">
          <p className="text-center text-sm font-medium">
            {matchLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
