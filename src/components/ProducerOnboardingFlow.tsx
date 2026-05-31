import React, { useState } from 'react';
import { KYCForm } from './KYCForm';
import { ProducerProfileForm } from './ProducerProfileForm';
import { BankingForm } from './BankingForm';
import { ProducerOnboardingStepper } from './ProducerOnboardingStepper';

export const ProducerOnboardingFlow = ({ onFinish }: { onFinish?: () => void }) => {
  const [currentStep, setCurrentStep] = useState(1); // 1: KYC, 2: Profile, 3: Banking, 4: Review

  return (
    <div className="w-full">
      {currentStep === 1 && (
        <KYCForm onComplete={() => setCurrentStep(2)} />
      )}
      {currentStep === 2 && (
        <ProducerProfileForm onComplete={() => setCurrentStep(3)} />
      )}
      {currentStep === 3 && (
        <BankingForm onComplete={() => setCurrentStep(4)} />
      )}
      {currentStep === 4 && (
        <ProducerOnboardingStepper currentStatus="review" />
      )}
    </div>
  );
};
