import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VirtualEventService } from '../../../ameni-ve/services/virtual-event.service';

@Component({
  selector: 'app-voice2-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './management.component.html',
  styleUrls: ['./management.component.css'],
})
export class Voice2ManagementComponent implements OnInit {
  events: any[] = [];

  constructor(private eventService: VirtualEventService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.eventService.getAllEvents().subscribe((res) => {
      this.events = res as any[];
    });
  }
}
