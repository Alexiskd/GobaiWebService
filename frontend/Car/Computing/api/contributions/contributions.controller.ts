// Contrôleur du domaine contributions : lecture, inscription, connexion, publication, vote, suppression.
import { Controller, Get, HttpException, HttpStatus, Post } from '@nestjs/common';
import { ContributionsService } from './contributions.service';

// Les écritures et les comptes restent désactivés : même contrat que le client.
const indisponible = () => {
  throw new HttpException('Fonction indisponible en mode statique', HttpStatus.SERVICE_UNAVAILABLE);
};

@Controller()
export class ContributionsController {
  constructor(private readonly contributions: ContributionsService) {}

  @Get('/contributions')
  list() {
    return this.contributions.list();
  }

  @Post('/contributions/signup')
  signup() {
    indisponible();
  }

  @Post('/contributions/login')
  login() {
    indisponible();
  }

  @Post('/contributions')
  publish() {
    indisponible();
  }

  @Post('/contributions/vote')
  vote() {
    indisponible();
  }

  @Post('/contributions/remove')
  remove() {
    indisponible();
  }
}
