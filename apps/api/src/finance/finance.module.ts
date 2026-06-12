import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { PriceListController } from './price-list.controller';
import { PriceListService } from './price-list.service';
import { ServicePackageController } from './service-package.controller';
import { ServicePackageService } from './service-package.service';
import { AdvanceDepositController } from './advance-deposit.controller';
import { AdvanceDepositService } from './advance-deposit.service';
import { CostEstimateController } from './cost-estimate.controller';
import { CostEstimateService } from './cost-estimate.service';
import { FinanceGovernanceController } from './finance-governance.controller';
import { FinanceGovernanceService } from './finance-governance.service';

@Module({
  imports: [BillingModule],
  controllers: [
    FinanceController, 
    PriceListController, 
    ServicePackageController, 
    AdvanceDepositController,
    CostEstimateController,
    FinanceGovernanceController
  ],
  providers: [
    FinanceService, 
    PriceListService, 
    ServicePackageService, 
    AdvanceDepositService,
    CostEstimateService,
    FinanceGovernanceService
  ],
  exports: [
    FinanceService, 
    PriceListService, 
    ServicePackageService, 
    AdvanceDepositService,
    CostEstimateService,
    FinanceGovernanceService
  ],
})
export class FinanceModule {}
