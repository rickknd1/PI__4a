import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-vote-success',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './vote-success.component.html',
  styleUrls: ['./vote-success.component.css']
})
export class VoteSuccessComponent implements OnInit {
  electionTitle: string = '';
  countdown: number = 5;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.electionTitle = this.route.snapshot.queryParams['electionTitle'] || 'l\'élection';
    
    // Redirection automatique après 5 secondes
    this.startCountdown();
  }

  startCountdown() {
    const interval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(interval);
        this.redirectToElections();
      }
    }, 1000);
  }

  redirectToElections() {
    this.router.navigate(['/elections']);
  }
}
