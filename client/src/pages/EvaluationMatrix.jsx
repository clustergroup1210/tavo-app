import React from 'react';
import EvaluationMatrixTable from '../components/EvaluationMatrixTable';

export default function EvaluationMatrix() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">評価マトリクス</h1>
      <EvaluationMatrixTable />
    </div>
  );
}
