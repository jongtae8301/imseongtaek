import { Icon } from './icons';
import type { Lesson } from '../examples/lesson';
export type { Lesson } from '../examples/lesson';
export function LessonGuide({ lesson }: { lesson: Lesson }) {
  return (
    <details className="lesson-guide">
      <summary>
        <Icon name="book" />
        관찰에서 설명으로<span>학습 목표와 비교 활동</span>
      </summary>
      <div className="lesson-guide-content">
        <div>
          <h3>학습 목표</h3>
          <p>{lesson.goal}</p>
          <small>{lesson.unit}</small>
          <p>관찰할 상태: {lesson.observe}</p>
        </div>
        <div>
          <h3>자기 말로 설명하기</h3>
          <p>{lesson.explain}</p>
        </div>
        <div>
          <h3>비교하고 재적용하기</h3>
          <p>{lesson.compare}</p>
          <p>{lesson.reapply}</p>
        </div>
      </div>
    </details>
  );
}
