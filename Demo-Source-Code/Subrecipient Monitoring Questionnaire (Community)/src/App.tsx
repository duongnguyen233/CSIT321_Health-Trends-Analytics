import { useState } from 'react';
import { Button } from './components/ui/button';
import { Progress } from './components/ui/progress';
import { Separator } from './components/ui/separator';
import { GlobalNavigation } from './components/global-navigation';
import { DomainTabs } from './components/domain-tabs';
import { DomainForm } from './components/domain-form';
import { QualityQuestionField } from './components/quality-question-field';
import { Save, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from './components/ui/alert';

interface FormData {
  [key: string]: any;
}

interface ValidationErrors {
  [key: string]: string;
}

export default function App() {
  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [currentDomain, setCurrentDomain] = useState(1);

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateDomain = (domainId: number) => {
    const newErrors: ValidationErrors = {};
    const requiredFields = getRequiredFieldsForDomain(domainId);

    requiredFields.forEach(field => {
      if (!formData[field] || formData[field] === '') {
        newErrors[field] = 'This field is required';
      }
    });

    // Validate numeric fields
    Object.keys(formData).forEach(field => {
      const value = formData[field];
      if (field.includes('count') || field.includes('number') || field.includes('rate')) {
        if (value && !/^\d+$/.test(value.toString())) {
          newErrors[field] = 'Please enter numbers only';
        }
      }
    });

    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const getRequiredFieldsForDomain = (domainId: number): string[] => {
    switch (domainId) {
      case 1: return ['pressure_injury_count', 'assessment_date'];
      case 2: return ['restrictive_practices_count', 'assessment_date'];
      case 3: return ['significant_weight_loss_count', 'assessment_date'];
      case 4: return ['consecutive_weight_loss_count', 'assessment_date'];
      case 5: return ['falls_count', 'major_injury_count', 'assessment_date'];
      case 6: return ['polypharmacy_count', 'assessment_date'];
      case 7: return ['antipsychotic_count', 'assessment_date'];
      case 8: return ['adl_decline_count', 'assessment_date'];
      case 9: return ['incontinence_issues_count', 'assessment_date'];
      case 10: return ['hospitalization_count', 'assessment_date'];
      case 11: return ['staff_turnover_rate', 'assessment_date'];
      case 12: return ['consumer_satisfaction_score', 'assessment_date'];
      case 13: return ['quality_of_life_score', 'assessment_date'];
      default: return [];
    }
  };

  const getCompletedDomains = (): number[] => {
    const completed: number[] = [];
    for (let i = 1; i <= 13; i++) {
      const requiredFields = getRequiredFieldsForDomain(i);
      if (requiredFields.every(field => formData[field] && formData[field] !== '')) {
        completed.push(i);
      }
    }
    return completed;
  };

  const getDomainsWithErrors = (): number[] => {
    const domainsWithErrors: number[] = [];
    for (let i = 1; i <= 13; i++) {
      const requiredFields = getRequiredFieldsForDomain(i);
      if (requiredFields.some(field => errors[field])) {
        domainsWithErrors.push(i);
      }
    }
    return domainsWithErrors;
  };

  const handleNext = () => {
    if (validateDomain(currentDomain)) {
      setCurrentDomain(prev => Math.min(prev + 1, 13));
    }
  };

  const handlePrevious = () => {
    setCurrentDomain(prev => Math.max(prev - 1, 1));
  };

  const handleSave = () => {
    console.log('Saving form data:', formData);
    alert('Form data saved as draft successfully!');
  };

  const handleSubmit = () => {
    let allValid = true;
    for (let i = 1; i <= 13; i++) {
      if (!validateDomain(i)) {
        allValid = false;
      }
    }

    if (allValid) {
      console.log('Submitting complete form:', formData);
      alert('Quality Indicator questionnaire submitted successfully!');
    } else {
      alert('Please complete all required fields before submitting.');
    }
  };

  const renderDomainForm = () => {
    switch (currentDomain) {
      case 1:
        return (
          <DomainForm
            title="Pressure Injuries"
            description="Assessment of pressure injury incidents and prevention measures"
          >
            <QualityQuestionField
              id="pressure_injury_count"
              label="Number of residents with new or worsened pressure injuries"
              type="number"
              required
              value={formData.pressure_injury_count}
              onChange={(value) => updateFormData('pressure_injury_count', value)}
              error={errors.pressure_injury_count}
              min={0}
            />
            <QualityQuestionField
              id="assessment_date"
              label="Assessment period end date"
              type="date"
              required
              value={formData.assessment_date}
              onChange={(value) => updateFormData('assessment_date', value)}
              error={errors.assessment_date}
            />
            <QualityQuestionField
              id="total_residents"
              label="Total number of residents"
              type="number"
              value={formData.total_residents}
              onChange={(value) => updateFormData('total_residents', value)}
              min={1}
            />
            <QualityQuestionField
              id="prevention_measures"
              label="Describe current pressure injury prevention measures"
              type="comment"
              value={formData.prevention_measures}
              onChange={(value) => updateFormData('prevention_measures', value)}
            />
          </DomainForm>
        );

      case 2:
        return (
          <DomainForm
            title="Restrictive Practices"
            description="Monitoring of restrictive practice usage and alternatives"
          >
            <QualityQuestionField
              id="restrictive_practices_count"
              label="Number of restrictive practice incidents"
              type="number"
              required
              value={formData.restrictive_practices_count}
              onChange={(value) => updateFormData('restrictive_practices_count', value)}
              error={errors.restrictive_practices_count}
              min={0}
            />
            <QualityQuestionField
              id="assessment_date"
              label="Assessment period end date"
              type="date"
              required
              value={formData.assessment_date}
              onChange={(value) => updateFormData('assessment_date', value)}
              error={errors.assessment_date}
            />
            <QualityQuestionField
              id="physical_restraints"
              label="Number of physical restraint uses"
              type="number"
              value={formData.physical_restraints}
              onChange={(value) => updateFormData('physical_restraints', value)}
              min={0}
            />
            <QualityQuestionField
              id="chemical_restraints"
              label="Number of chemical restraint uses"
              type="number"
              value={formData.chemical_restraints}
              onChange={(value) => updateFormData('chemical_restraints', value)}
              min={0}
            />
            <QualityQuestionField
              id="alternative_strategies"
              label="Describe alternative strategies being used"
              type="comment"
              value={formData.alternative_strategies}
              onChange={(value) => updateFormData('alternative_strategies', value)}
            />
          </DomainForm>
        );

      case 3:
        return (
          <DomainForm
            title="Unplanned Weight Loss – Significant"
            description="Tracking significant unplanned weight loss (≥5% in 30 days or ≥10% in 180 days)"
          >
            <QualityQuestionField
              id="significant_weight_loss_count"
              label="Number of residents with significant unplanned weight loss"
              type="number"
              required
              value={formData.significant_weight_loss_count}
              onChange={(value) => updateFormData('significant_weight_loss_count', value)}
              error={errors.significant_weight_loss_count}
              min={0}
            />
            <QualityQuestionField
              id="assessment_date"
              label="Assessment period end date"
              type="date"
              required
              value={formData.assessment_date}
              onChange={(value) => updateFormData('assessment_date', value)}
              error={errors.assessment_date}
            />
            <QualityQuestionField
              id="weight_monitoring_frequency"
              label="Weight monitoring frequency (days)"
              type="number"
              value={formData.weight_monitoring_frequency}
              onChange={(value) => updateFormData('weight_monitoring_frequency', value)}
              min={1}
            />
            <QualityQuestionField
              id="nutritional_interventions"
              label="Describe nutritional interventions in place"
              type="comment"
              value={formData.nutritional_interventions}
              onChange={(value) => updateFormData('nutritional_interventions', value)}
            />
          </DomainForm>
        );

      case 4:
        return (
          <DomainForm
            title="Unplanned Weight Loss – Consecutive"
            description="Tracking consecutive unplanned weight loss over multiple periods"
          >
            <QualityQuestionField
              id="consecutive_weight_loss_count"
              label="Number of residents with consecutive weight loss"
              type="number"
              required
              value={formData.consecutive_weight_loss_count}
              onChange={(value) => updateFormData('consecutive_weight_loss_count', value)}
              error={errors.consecutive_weight_loss_count}
              min={0}
            />
            <QualityQuestionField
              id="assessment_date"
              label="Assessment period end date"
              type="date"
              required
              value={formData.assessment_date}
              onChange={(value) => updateFormData('assessment_date', value)}
              error={errors.assessment_date}
            />
            <QualityQuestionField
              id="consecutive_periods"
              label="Number of consecutive periods tracked"
              type="number"
              value={formData.consecutive_periods}
              onChange={(value) => updateFormData('consecutive_periods', value)}
              min={2}
            />
            <QualityQuestionField
              id="intervention_effectiveness"
              label="Assessment of intervention effectiveness"
              type="comment"
              value={formData.intervention_effectiveness}
              onChange={(value) => updateFormData('intervention_effectiveness', value)}
            />
          </DomainForm>
        );

      case 5:
        return (
          <DomainForm
            title="Falls and Major Injury"
            description="Monitoring falls incidents and resulting major injuries"
          >
            <QualityQuestionField
              id="falls_count"
              label="Total number of falls"
              type="number"
              required
              value={formData.falls_count}
              onChange={(value) => updateFormData('falls_count', value)}
              error={errors.falls_count}
              min={0}
            />
            <QualityQuestionField
              id="major_injury_count"
              label="Number of falls resulting in major injury"
              type="number"
              required
              value={formData.major_injury_count}
              onChange={(value) => updateFormData('major_injury_count', value)}
              error={errors.major_injury_count}
              min={0}
            />
            <QualityQuestionField
              id="assessment_date"
              label="Assessment period end date"
              type="date"
              required
              value={formData.assessment_date}
              onChange={(value) => updateFormData('assessment_date', value)}
              error={errors.assessment_date}
            />
            <QualityQuestionField
              id="fall_prevention_program"
              label="Describe fall prevention program"
              type="comment"
              value={formData.fall_prevention_program}
              onChange={(value) => updateFormData('fall_prevention_program', value)}
            />
          </DomainForm>
        );

      case 6:
        return (
          <DomainForm
            title="Medication – Polypharmacy"
            description="Assessment of residents receiving multiple medications"
          >
            <QualityQuestionField
              id="polypharmacy_count"
              label="Number of residents with polypharmacy (≥9 medications)"
              type="number"
              required
              value={formData.polypharmacy_count}
              onChange={(value) => updateFormData('polypharmacy_count', value)}
              error={errors.polypharmacy_count}
              min={0}
            />
            <QualityQuestionField
              id="assessment_date"
              label="Assessment period end date"
              type="date"
              required
              value={formData.assessment_date}
              onChange={(value) => updateFormData('assessment_date', value)}
              error={errors.assessment_date}
            />
            <QualityQuestionField
              id="medication_review_frequency"
              label="Medication review frequency (days)"
              type="number"
              value={formData.medication_review_frequency}
              onChange={(value) => updateFormData('medication_review_frequency', value)}
              min={1}
            />
            <QualityQuestionField
              id="deprescribing_initiatives"
              label="Describe deprescribing initiatives"
              type="comment"
              value={formData.deprescribing_initiatives}
              onChange={(value) => updateFormData('deprescribing_initiatives', value)}
            />
          </DomainForm>
        );

      case 7:
        return (
          <DomainForm
            title="Medication – Antipsychotics"
            description="Monitoring antipsychotic medication usage"
          >
            <QualityQuestionField
              id="antipsychotic_count"
              label="Number of residents receiving antipsychotics"
              type="number"
              required
              value={formData.antipsychotic_count}
              onChange={(value) => updateFormData('antipsychotic_count', value)}
              error={errors.antipsychotic_count}
              min={0}
            />
            <QualityQuestionField
              id="assessment_date"
              label="Assessment period end date"
              type="date"
              required
              value={formData.assessment_date}
              onChange={(value) => updateFormData('assessment_date', value)}
              error={errors.assessment_date}
            />
            <QualityQuestionField
              id="behavioral_interventions"
              label="Number receiving behavioral interventions first"
              type="number"
              value={formData.behavioral_interventions}
              onChange={(value) => updateFormData('behavioral_interventions', value)}
              min={0}
            />
            <QualityQuestionField
              id="gradual_dose_reduction"
              label="Describe gradual dose reduction attempts"
              type="comment"
              value={formData.gradual_dose_reduction}
              onChange={(value) => updateFormData('gradual_dose_reduction', value)}
            />
          </DomainForm>
        );

      case 8:
        return (
          <DomainForm
            title="Activities of Daily Living (ADLs)"
            description="Assessment of ADL performance and support needs"
          >
            <QualityQuestionField
              id="adl_decline_count"
              label="Number of residents with ADL decline"
              type="number"
              required
              value={formData.adl_decline_count}
              onChange={(value) => updateFormData('adl_decline_count', value)}
              error={errors.adl_decline_count}
              min={0}
            />
            <QualityQuestionField
              id="assessment_date"
              label="Assessment period end date"
              type="date"
              required
              value={formData.assessment_date}
              onChange={(value) => updateFormData('assessment_date', value)}
              error={errors.assessment_date}
            />
            <QualityQuestionField
              id="rehabilitation_services"
              label="Number receiving rehabilitation services"
              type="number"
              value={formData.rehabilitation_services}
              onChange={(value) => updateFormData('rehabilitation_services', value)}
              min={0}
            />
            <QualityQuestionField
              id="adl_support_strategies"
              label="Describe ADL support strategies"
              type="comment"
              value={formData.adl_support_strategies}
              onChange={(value) => updateFormData('adl_support_strategies', value)}
            />
          </DomainForm>
        );

      case 9:
        return (
          <DomainForm
            title="Incontinence Care (IAD)"
            description="Management of incontinence-associated dermatitis"
          >
            <QualityQuestionField
              id="incontinence_issues_count"
              label="Number of residents with incontinence-associated dermatitis"
              type="number"
              required
              value={formData.incontinence_issues_count}
              onChange={(value) => updateFormData('incontinence_issues_count', value)}
              error={errors.incontinence_issues_count}
              min={0}
            />
            <QualityQuestionField
              id="assessment_date"
              label="Assessment period end date"
              type="date"
              required
              value={formData.assessment_date}
              onChange={(value) => updateFormData('assessment_date', value)}
              error={errors.assessment_date}
            />
            <QualityQuestionField
              id="continence_program"
              label="Number in continence management program"
              type="number"
              value={formData.continence_program}
              onChange={(value) => updateFormData('continence_program', value)}
              min={0}
            />
            <QualityQuestionField
              id="skin_care_protocols"
              label="Describe skin care protocols"
              type="comment"
              value={formData.skin_care_protocols}
              onChange={(value) => updateFormData('skin_care_protocols', value)}
            />
          </DomainForm>
        );

      case 10:
        return (
          <DomainForm
            title="Hospitalisation"
            description="Tracking hospitalization rates and causes"
          >
            <QualityQuestionField
              id="hospitalization_count"
              label="Number of hospitalizations"
              type="number"
              required
              value={formData.hospitalization_count}
              onChange={(value) => updateFormData('hospitalization_count', value)}
              error={errors.hospitalization_count}
              min={0}
            />
            <QualityQuestionField
              id="assessment_date"
              label="Assessment period end date"
              type="date"
              required
              value={formData.assessment_date}
              onChange={(value) => updateFormData('assessment_date', value)}
              error={errors.assessment_date}
            />
            <QualityQuestionField
              id="preventable_hospitalizations"
              label="Number of potentially preventable hospitalizations"
              type="number"
              value={formData.preventable_hospitalizations}
              onChange={(value) => updateFormData('preventable_hospitalizations', value)}
              min={0}
            />
            <QualityQuestionField
              id="hospital_reduction_strategies"
              label="Describe hospitalization reduction strategies"
              type="comment"
              value={formData.hospital_reduction_strategies}
              onChange={(value) => updateFormData('hospital_reduction_strategies', value)}
            />
          </DomainForm>
        );

      case 11:
        return (
          <DomainForm
            title="Workforce"
            description="Staff turnover and workforce stability measures"
          >
            <QualityQuestionField
              id="staff_turnover_rate"
              label="Staff turnover rate (%)"
              type="number"
              required
              value={formData.staff_turnover_rate}
              onChange={(value) => updateFormData('staff_turnover_rate', value)}
              error={errors.staff_turnover_rate}
              min={0}
              max={100}
            />
            <QualityQuestionField
              id="assessment_date"
              label="Assessment period end date"
              type="date"
              required
              value={formData.assessment_date}
              onChange={(value) => updateFormData('assessment_date', value)}
              error={errors.assessment_date}
            />
            <QualityQuestionField
              id="retention_initiatives"
              label="Number of staff retention initiatives"
              type="number"
              value={formData.retention_initiatives}
              onChange={(value) => updateFormData('retention_initiatives', value)}
              min={0}
            />
            <QualityQuestionField
              id="workforce_development"
              label="Describe workforce development programs"
              type="comment"
              value={formData.workforce_development}
              onChange={(value) => updateFormData('workforce_development', value)}
            />
          </DomainForm>
        );

      case 12:
        return (
          <DomainForm
            title="Consumer Experience (QCE-ACC)"
            description="Consumer experience assessment scores"
          >
            <QualityQuestionField
              id="consumer_satisfaction_score"
              label="Overall consumer satisfaction score (0-100)"
              type="number"
              required
              value={formData.consumer_satisfaction_score}
              onChange={(value) => updateFormData('consumer_satisfaction_score', value)}
              error={errors.consumer_satisfaction_score}
              min={0}
              max={100}
            />
            <QualityQuestionField
              id="assessment_date"
              label="Assessment period end date"
              type="date"
              required
              value={formData.assessment_date}
              onChange={(value) => updateFormData('assessment_date', value)}
              error={errors.assessment_date}
            />
            <QualityQuestionField
              id="response_rate"
              label="Survey response rate (%)"
              type="number"
              value={formData.response_rate}
              onChange={(value) => updateFormData('response_rate', value)}
              min={0}
              max={100}
            />
            <QualityQuestionField
              id="improvement_actions"
              label="Describe actions taken based on consumer feedback"
              type="comment"
              value={formData.improvement_actions}
              onChange={(value) => updateFormData('improvement_actions', value)}
            />
          </DomainForm>
        );

      case 13:
        return (
          <DomainForm
            title="Quality of Life (QOL-ACC)"
            description="Quality of life assessment and measures"
          >
            <QualityQuestionField
              id="quality_of_life_score"
              label="Overall quality of life score (0-100)"
              type="number"
              required
              value={formData.quality_of_life_score}
              onChange={(value) => updateFormData('quality_of_life_score', value)}
              error={errors.quality_of_life_score}
              min={0}
              max={100}
            />
            <QualityQuestionField
              id="assessment_date"
              label="Assessment period end date"
              type="date"
              required
              value={formData.assessment_date}
              onChange={(value) => updateFormData('assessment_date', value)}
              error={errors.assessment_date}
            />
            <QualityQuestionField
              id="lifestyle_programs"
              label="Number of lifestyle and wellness programs"
              type="number"
              value={formData.lifestyle_programs}
              onChange={(value) => updateFormData('lifestyle_programs', value)}
              min={0}
            />
            <QualityQuestionField
              id="quality_improvements"
              label="Describe quality of life improvement initiatives"
              type="comment"
              value={formData.quality_improvements}
              onChange={(value) => updateFormData('quality_improvements', value)}
            />
          </DomainForm>
        );

      default:
        return null;
    }
  };

  const completedDomains = getCompletedDomains();
  const domainsWithErrors = getDomainsWithErrors();
  const progressPercentage = (completedDomains.length / 13) * 100;

  return (
    <div className="min-h-screen bg-background">
      <GlobalNavigation />
      
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="mb-6">
          <h1 className="mb-2">Quality Indicator Questionnaire</h1>
          <p className="text-muted-foreground">
            Complete assessment across all 13 Quality Indicator domains to monitor care standards and outcomes.
          </p>
        </div>

        <Alert className="mb-6">
          <AlertDescription>
            Please complete all required fields marked with an asterisk (*). Numeric fields accept numbers only.
          </AlertDescription>
        </Alert>

        <div className="mb-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span>Overall Progress</span>
            <span className="text-sm text-muted-foreground">
              {completedDomains.length} of 13 domains completed
            </span>
          </div>
          <Progress value={progressPercentage} className="mb-2" />
          <p className="text-sm text-muted-foreground">
            {Math.round(progressPercentage)}% complete
          </p>
        </div>

        <DomainTabs
          currentDomain={currentDomain}
          onDomainChange={setCurrentDomain}
          completedDomains={completedDomains}
          domainsWithErrors={domainsWithErrors}
        />

        <div className="my-6">
          {renderDomainForm()}
        </div>

        <Separator className="my-6" />

        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handlePrevious}
              disabled={currentDomain === 1}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button 
              onClick={handleNext}
              disabled={currentDomain === 13}
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Save Draft
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={completedDomains.length < 13}
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Review & Submit
            </Button>
          </div>
        </div>

        <div className="mt-8 p-4 bg-muted/50 rounded-lg">
          <h4>Data Collection Guidelines:</h4>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1">
            <li>• All counts should reflect the most recent assessment period</li>
            <li>• Use consistent measurement periods across all domains</li>
            <li>• Ensure data accuracy before submission</li>
            <li>• Contact support if you need assistance with any indicators</li>
          </ul>
        </div>
      </div>
    </div>
  );
}